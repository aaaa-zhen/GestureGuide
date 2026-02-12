// Swipe Gesture Demo (Chapter 1)
// chenglou-style: DOM + transform3d, swipe card left or right

import { spring, springStep, springSnap, springAtRest } from '../engine/render-loop.js'
import { onResize } from '../engine/lifecycle.js'

const MS_PER_STEP = 4
const SWIPE_VELOCITY = 650   // px/s minimum to trigger swipe
const SWIPE_THRESHOLD = 60   // px displacement to trigger swipe
const VELOCITY_WINDOW_MS = 100
const MAX_STEPS_PER_FRAME = 500
const CARD_W = 120
const CARD_H = 160

export function initSwipeGesture() {
  const demo = document.getElementById('demo-swipe-gesture')
  if (!demo) return

  const readout = document.getElementById('swipe-g-readout')
  const hint = document.getElementById('hint-swipe-g')

  // Create card element
  const card = document.createElement('div')
  card.style.cssText = `
    position: absolute;
    left: 50%;
    top: 50%;
    width: ${CARD_W}px;
    height: ${CARD_H}px;
    margin-left: ${-CARD_W / 2}px;
    margin-top: ${-CARD_H / 2}px;
    border-radius: 12px;
    background: rgba(99, 102, 241, 0.1);
    border: 2px solid rgba(99, 102, 241, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    font: 12px -apple-system, BlinkMacSystemFont, sans-serif;
    color: rgba(0, 0, 0, 0.5);
    cursor: grab;
    will-change: transform, opacity;
    user-select: none;
  `
  card.textContent = '\u2190 swipe \u2192'
  demo.appendChild(card)

  // === state ===
  let cardX = spring(0, 0, 350, 26)
  let cardY = spring(0, 0, 350, 26)
  let cardRotation = spring(0, 0, 350, 26)
  let cardOpacity = spring(1, 0, 300, 20)
  let cardScale = spring(1, 0, 400, 24)

  let demoW = 0, demoH = 0
  let swipeCount = 0
  let animatedUntilTime = null

  // Dragging state
  let isDragging = false
  let dragStartX = 0
  let dragStartY = 0
  let pointerHistory = []
  let currentVelocity = 0

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

  function isInsideCard(pos) {
    const centerX = demoW / 2 + cardX.pos
    const centerY = demoH / 2 + cardY.pos
    return pos.x >= centerX - CARD_W / 2 && pos.x <= centerX + CARD_W / 2 &&
           pos.y >= centerY - CARD_H / 2 && pos.y <= centerY + CARD_H / 2
  }

  function resetCard() {
    cardX = spring(0, 0, 350, 26)
    cardY = spring(0, 0, 350, 26)
    cardRotation = spring(0, 0, 350, 26)
    cardOpacity = spring(1, 0, 300, 20)
    cardScale = spring(0.8, 0, 400, 24)
    cardScale.dest = 1
    animatedUntilTime = null
  }

  // === main render ===
  function render(now) {
    let stillAnimating = false

    // pointerdown
    if (events.pointerdown) {
      const pos = getPos(events.pointerdown)
      if (isInsideCard(pos)) {
        isDragging = true
        dragStartX = pos.x
        dragStartY = pos.y
        pointerHistory = [{ x: pos.x, time: now }]
        currentVelocity = 0
        cardScale.dest = 1.05
        if (hint) hint.style.display = 'none'
        card.style.cursor = 'grabbing'
      }
    }

    // pointermove
    if (events.pointermove && isDragging) {
      const pos = getPos(events.pointermove)
      pointerHistory.push({ x: pos.x, time: now })
      if (pointerHistory.length > 20) pointerHistory.shift()

      cardX.pos = pos.x - dragStartX
      cardX.dest = cardX.pos
      cardY.pos = (pos.y - dragStartY) * 0.3 // Reduced Y movement
      cardY.dest = cardY.pos
      cardRotation.pos = cardX.pos * 0.08
      cardRotation.dest = cardRotation.pos

      let i = pointerHistory.length - 1
      while (i > 0 && now - pointerHistory[i].time <= VELOCITY_WINDOW_MS) i--
      if (i < pointerHistory.length - 1) {
        const oldest = pointerHistory[i]
        const newest = pointerHistory[pointerHistory.length - 1]
        const dt = newest.time - oldest.time
        if (dt > 0) {
          currentVelocity = Math.abs((newest.x - oldest.x) / dt * 1000)
        }
      }
    }

    // pointerup
    if (events.pointerup && isDragging) {
      const pos = getPos(events.pointerup)
      const dx = pos.x - dragStartX
      pointerHistory.push({ x: pos.x, time: now })
      if (pointerHistory.length > 20) pointerHistory.shift()

      let velocity = 0
      let i = pointerHistory.length - 1
      while (i > 0 && now - pointerHistory[i].time <= VELOCITY_WINDOW_MS) i--
      if (i < pointerHistory.length - 1) {
        const oldest = pointerHistory[i]
        const newest = pointerHistory[pointerHistory.length - 1]
        const dt = newest.time - oldest.time
        if (dt > 0) velocity = Math.abs((newest.x - oldest.x) / dt * 1000)
      }

      const shouldSwipe = Math.abs(dx) > SWIPE_THRESHOLD || velocity > SWIPE_VELOCITY

      if (shouldSwipe) {
        // Swipe out
        const dir = dx > 0 ? 1 : -1
        swipeCount++
        cardX.dest = dir * (demoW + CARD_W)
        cardRotation.dest = dir * 30
        cardOpacity.dest = 0

        readout.innerHTML =
          `SWIPE ${dir > 0 ? 'RIGHT' : 'LEFT'} #<span class="val">${swipeCount}</span> ` +
          `(<span class="val">${Math.round(Math.abs(dx))}px</span>, <span class="val">${Math.round(velocity)}px/s</span>)`

        // Reset card after animation
        setTimeout(() => {
          resetCard()
          scheduleRender()
        }, 300)
      } else {
        // Bounce back
        cardX.dest = 0
        cardY.dest = 0
        cardRotation.dest = 0
        cardScale.dest = 1
        readout.innerHTML =
          `not a swipe — <span class="val">${Math.round(Math.abs(dx))}px</span> / ${SWIPE_THRESHOLD}px, ` +
          `<span class="val">${Math.round(velocity)}px/s</span> / ${SWIPE_VELOCITY}px/s`
      }

      isDragging = false
      pointerHistory = []
      currentVelocity = 0
      card.style.cursor = 'grab'
      animatedUntilTime = null
    }

    // Physics
    let newAnimatedUntilTime = animatedUntilTime ?? now
    const steps = Math.min(Math.floor((now - newAnimatedUntilTime) / MS_PER_STEP), MAX_STEPS_PER_FRAME)
    newAnimatedUntilTime += steps * MS_PER_STEP

    const springs = [cardX, cardY, cardRotation, cardOpacity, cardScale]
    for (const s of springs) {
      for (let i = 0; i < steps; i++) springStep(s)
      if (!springAtRest(s)) stillAnimating = true
      else springSnap(s)
    }

    animatedUntilTime = stillAnimating ? newAnimatedUntilTime : null

    // === DOM write ===
    // Check if past threshold
    const pastThreshold = Math.abs(cardX.pos) > SWIPE_THRESHOLD
    const speedReady = currentVelocity > SWIPE_VELOCITY
    const swipeReady = pastThreshold || speedReady

    card.style.transform = `translate3d(${cardX.pos}px, ${cardY.pos}px, 0) rotate(${cardRotation.pos}deg) scale(${cardScale.pos})`
    card.style.opacity = cardOpacity.pos

    // Update card appearance
    if (swipeReady) {
      card.style.background = 'rgba(231, 76, 60, 0.15)'
      card.style.borderColor = 'rgba(231, 76, 60, 0.6)'
      card.style.color = 'rgba(231, 76, 60, 0.8)'
      card.textContent = 'release to swipe'
    } else {
      card.style.background = 'rgba(99, 102, 241, 0.1)'
      card.style.borderColor = 'rgba(99, 102, 241, 0.4)'
      card.style.color = 'rgba(0, 0, 0, 0.5)'
      card.textContent = '\u2190 swipe \u2192'
    }

    if (isDragging) {
      readout.innerHTML =
        `<span class="val">${Math.round(Math.abs(cardX.pos))}px</span> / ${SWIPE_THRESHOLD}px, ` +
        `<span class="val">${Math.round(currentVelocity)}px/s</span> / ${SWIPE_VELOCITY}px/s`
    }

    // Clear events
    events.pointerdown = null
    events.pointermove = null
    events.pointerup = null

    return stillAnimating || isDragging
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
if (document.getElementById('demo-swipe-gesture')) {
  initSwipeGesture()
}
