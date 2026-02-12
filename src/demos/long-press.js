// Long Press Demo (Chapter 1)
// chenglou-style: DOM + transform3d, tap anywhere shows progress ring

import { spring, springStep, springSnap, springAtRest, GESTURE } from '../engine/render-loop.js'
import { onResize } from '../engine/lifecycle.js'

const MS_PER_STEP = 4

export function initLongPress() {
  const demo = document.getElementById('demo-longpress')
  if (!demo) return

  const readout = document.getElementById('lp-readout')
  const hint = document.getElementById('hint-lp')

  // Container for press circles
  const pressContainer = document.createElement('div')
  pressContainer.style.cssText = `
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
  `
  demo.appendChild(pressContainer)

  // Active progress ring (SVG for arc)
  const progressSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  progressSvg.style.cssText = `
    position: absolute;
    width: 60px;
    height: 60px;
    pointer-events: none;
    opacity: 0;
    will-change: transform, opacity;
  `
  progressSvg.setAttribute('viewBox', '0 0 60 60')

  const progressBg = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
  progressBg.setAttribute('cx', '30')
  progressBg.setAttribute('cy', '30')
  progressBg.setAttribute('r', '26')
  progressBg.setAttribute('fill', 'rgba(112, 64, 176, 0.1)')
  progressBg.setAttribute('stroke', 'rgba(112, 64, 176, 0.2)')
  progressBg.setAttribute('stroke-width', '3')
  progressSvg.appendChild(progressBg)

  const progressArc = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
  progressArc.setAttribute('cx', '30')
  progressArc.setAttribute('cy', '30')
  progressArc.setAttribute('r', '26')
  progressArc.setAttribute('fill', 'none')
  progressArc.setAttribute('stroke', 'rgba(112, 64, 176, 0.6)')
  progressArc.setAttribute('stroke-width', '3')
  progressArc.setAttribute('stroke-linecap', 'round')
  progressArc.setAttribute('transform', 'rotate(-90 30 30)')
  const circumference = 2 * Math.PI * 26
  progressArc.setAttribute('stroke-dasharray', `${circumference}`)
  progressArc.setAttribute('stroke-dashoffset', `${circumference}`)
  progressSvg.appendChild(progressArc)

  demo.appendChild(progressSvg)

  // === state ===
  let lpCount = 0
  let isDown = false
  let keyHoldActive = false
  let downX = 0, downY = 0, downTime = 0
  let canceled = false
  let completedPresses = [] // { el, x, y, scale: spring, createdAt }
  let animatedUntilTime = null
  const FADE_DELAY = 400
  const FADE_DURATION = 300

  // === events ===
  const events = {
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

  function getPos(e) {
    const rect = demo.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function createKeyboardPointerEvent() {
    const rect = demo.getBoundingClientRect()
    return {
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
      timeStamp: performance.now(),
    }
  }

  function createCompletedCircle(x, y) {
    const el = document.createElement('div')
    el.style.cssText = `
      position: absolute;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: rgba(39, 174, 96, 0.15);
      border: 2px solid rgba(39, 174, 96, 0.5);
      pointer-events: none;
      will-change: transform, opacity;
    `
    el.style.left = `${x - 28}px`
    el.style.top = `${y - 28}px`
    pressContainer.appendChild(el)
    return el
  }

  // === main render ===
  function render(now) {
    let stillAnimating = false

    // pointerdown
    if (events.pointerdown) {
      const e = events.pointerdown
      const pos = getPos(e)
      isDown = true
      downX = pos.x
      downY = pos.y
      downTime = now
      canceled = false
      if (hint) hint.style.display = 'none'
    }

    // pointermove - cancel if moved too far
    if (events.pointermove && isDown && !canceled) {
      const e = events.pointermove
      const pos = getPos(e)
      const dist = Math.hypot(pos.x - downX, pos.y - downY)
      if (dist > GESTURE.TOUCH_SLOP) {
        canceled = true
        readout.innerHTML = `canceled — moved <span class="val">${Math.round(dist)}px</span>`
      }
    }

    // pointerup
    if (events.pointerup && isDown) {
      const dt = now - downTime
      if (!canceled && dt < GESTURE.LONG_PRESS_MS) {
        readout.innerHTML = `too short — <span class="val">${Math.round(dt)}ms</span>`
      }
      isDown = false
    }

    // Check for long press completion
    if (isDown && !canceled) {
      const elapsed = now - downTime
      if (elapsed >= GESTURE.LONG_PRESS_MS) {
        lpCount++
        const s = spring(0, 0, 350, 24)
        s.dest = 1
        const el = createCompletedCircle(downX, downY)
        completedPresses.push({ el, x: downX, y: downY, scale: s, createdAt: now })
        animatedUntilTime = null
        readout.innerHTML = `LONG PRESS #<span class="val">${lpCount}</span>`
        isDown = false
      }
    }

    // Physics for completed presses
    let newAnimatedUntilTime = animatedUntilTime ?? now
    const steps = Math.floor((now - newAnimatedUntilTime) / MS_PER_STEP)
    newAnimatedUntilTime += steps * MS_PER_STEP

    for (const press of completedPresses) {
      for (let i = 0; i < steps; i++) springStep(press.scale)
      if (!springAtRest(press.scale)) stillAnimating = true
      else springSnap(press.scale)
    }

    animatedUntilTime = stillAnimating ? newAnimatedUntilTime : null

    // === DOM write ===
    // Update active progress ring
    if (isDown && !canceled) {
      const elapsed = now - downTime
      const progress = Math.min(1, elapsed / GESTURE.LONG_PRESS_MS)
      const nearComplete = progress > 0.8

      progressSvg.style.left = `${downX - 30}px`
      progressSvg.style.top = `${downY - 30}px`
      progressSvg.style.opacity = '1'

      // Update colors based on progress
      const color = nearComplete ? '39, 174, 96' : '112, 64, 176'
      progressBg.setAttribute('fill', `rgba(${color}, 0.1)`)
      progressBg.setAttribute('stroke', `rgba(${color}, 0.2)`)
      progressArc.setAttribute('stroke', `rgba(${color}, ${nearComplete ? 0.7 : 0.6})`)

      // Update progress arc
      const offset = circumference * (1 - progress)
      progressArc.setAttribute('stroke-dashoffset', `${offset}`)

      readout.innerHTML = `hold = <span class="val">${Math.round(elapsed)}ms</span> / ${GESTURE.LONG_PRESS_MS}ms`
      stillAnimating = true
    } else {
      progressSvg.style.opacity = '0'
    }

    // Update completed presses
    for (let i = completedPresses.length - 1; i >= 0; i--) {
      const press = completedPresses[i]
      const { el, scale, createdAt } = press
      const s = scale.pos

      const age = now - createdAt
      let alpha = 1
      if (age > FADE_DELAY) {
        const fadeProgress = (age - FADE_DELAY) / FADE_DURATION
        alpha = 1 - fadeProgress
        if (alpha <= 0) {
          el.remove()
          completedPresses.splice(i, 1)
          continue
        }
        stillAnimating = true
      }

      el.style.transform = `scale(${s})`
      el.style.opacity = alpha
    }

    // Clear events
    events.pointerdown = null
    events.pointermove = null
    events.pointerup = null

    return stillAnimating || isDown || completedPresses.length > 0
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
    if ((e.key === 'Enter' || e.key === ' ') && !keyHoldActive) {
      e.preventDefault()
      keyHoldActive = true
      events.pointerdown = createKeyboardPointerEvent()
      scheduleRender()
    }
  })

  demo.addEventListener('keyup', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && keyHoldActive) {
      e.preventDefault()
      keyHoldActive = false
      events.pointerup = createKeyboardPointerEvent()
      scheduleRender()
    }
  })

  demo.addEventListener('blur', () => {
    if (keyHoldActive) {
      keyHoldActive = false
      events.pointerup = createKeyboardPointerEvent()
      scheduleRender()
    }
  })

  // Initial render
  scheduleRender()
}

// Auto-init
if (document.getElementById('demo-longpress')) {
  initLongPress()
}
