// Touch Down Demo (Chapter 1)
// chenglou-style: DOM + transform3d, tap anywhere shows ripple feedback

import { spring, springStep, springSnap, springAtRest } from '../engine/render-loop.js'
import { onResize } from '../engine/lifecycle.js'

const MS_PER_STEP = 4

export function initTouchDown() {
  const demo = document.getElementById('demo-touchdown')
  if (!demo) return

  const readout = document.getElementById('td-readout')
  const hint = document.getElementById('hint-td')

  // Container for touch ripples
  const rippleContainer = document.createElement('div')
  rippleContainer.style.cssText = `
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
  `
  demo.appendChild(rippleContainer)

  // === state ===
  // Each touch point has its own DOM element and spring
  const touches = new Map() // pointerId -> { outer, inner, ripple: spring, released }
  let animatedUntilTime = null

  // === events ===
  const events = {
    pointerdown: [],
    pointerup: [],
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

  function createTouchElements(x, y) {
    const color = '99, 102, 241' // indigo

    // Outer ripple ring
    const outer = document.createElement('div')
    outer.style.cssText = `
      position: absolute;
      width: 100px;
      height: 100px;
      border-radius: 50%;
      background: rgba(${color}, 0.15);
      pointer-events: none;
      will-change: transform, opacity;
    `
    outer.style.left = `${x - 50}px`
    outer.style.top = `${y - 50}px`
    rippleContainer.appendChild(outer)

    // Inner dot
    const inner = document.createElement('div')
    inner.style.cssText = `
      position: absolute;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: rgba(${color}, 0.9);
      pointer-events: none;
      will-change: transform, opacity;
    `
    inner.style.left = `${x - 8}px`
    inner.style.top = `${y - 8}px`
    rippleContainer.appendChild(inner)

    return { outer, inner }
  }

  // === main render ===
  function render(now) {
    let stillAnimating = false

    // Process pointerdown
    for (const e of events.pointerdown) {
      if (hint) hint.style.display = 'none'
      const pos = getPos(e)
      const { outer, inner } = createTouchElements(pos.x, pos.y)
      const ripple = spring(0, 0, 350, 20)
      ripple.dest = 1
      touches.set(e.pointerId, {
        x: pos.x,
        y: pos.y,
        outer,
        inner,
        ripple,
        released: false,
      })
      animatedUntilTime = null
    }

    // Process pointerup
    for (const e of events.pointerup) {
      const touch = touches.get(e.pointerId)
      if (touch) {
        touch.released = true
        touch.ripple.dest = 0 // fade out
        animatedUntilTime = null
      }
    }

    // Physics
    let newAnimatedUntilTime = animatedUntilTime ?? now
    const steps = Math.floor((now - newAnimatedUntilTime) / MS_PER_STEP)
    newAnimatedUntilTime += steps * MS_PER_STEP

    for (const [id, touch] of touches) {
      for (let i = 0; i < steps; i++) springStep(touch.ripple)

      if (springAtRest(touch.ripple)) {
        springSnap(touch.ripple)
        // Remove if released and faded out
        if (touch.released && touch.ripple.pos < 0.01) {
          touch.outer.remove()
          touch.inner.remove()
          touches.delete(id)
        }
      } else {
        stillAnimating = true
      }
    }

    animatedUntilTime = stillAnimating ? newAnimatedUntilTime : null

    // === DOM write ===
    for (const [id, touch] of touches) {
      const { outer, inner, ripple, released } = touch
      const value = ripple.pos

      if (value < 0.01) {
        outer.style.opacity = '0'
        inner.style.opacity = '0'
        continue
      }

      // Outer ripple
      outer.style.transform = `scale(${value})`
      outer.style.opacity = value

      // Inner dot (only when pressed)
      if (!released || value > 0.5) {
        const dotScale = released ? value : 1
        inner.style.transform = `scale(${dotScale})`
        inner.style.opacity = released ? value * 0.8 : 0.9
      } else {
        inner.style.opacity = '0'
      }
    }

    // Update readout
    const activeCount = [...touches.values()].filter(t => !t.released).length
    if (activeCount > 0) {
      readout.innerHTML = `touches = <span class="val">${activeCount}</span>`
    } else if (touches.size > 0) {
      readout.innerHTML = `state = <span class="val">released</span>`
    } else {
      readout.innerHTML = ''
    }

    // Clear events
    events.pointerdown = []
    events.pointerup = []

    return stillAnimating || touches.size > 0
  }

  // === event listeners ===
  demo.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    demo.setPointerCapture(e.pointerId)
    events.pointerdown.push(e)
    scheduleRender()
  }, { passive: false })

  demo.addEventListener('pointerup', (e) => {
    events.pointerup.push(e)
    scheduleRender()
  })

  demo.addEventListener('pointercancel', (e) => {
    events.pointerup.push(e)
    scheduleRender()
  })

  // Initial render
  scheduleRender()
}

// Auto-init
if (document.getElementById('demo-touchdown')) {
  initTouchDown()
}
