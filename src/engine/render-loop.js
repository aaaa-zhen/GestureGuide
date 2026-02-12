// Render Loop — chenglou-style unified rendering architecture
// Events are collected, not immediately processed. All logic runs in a single render() function.

const MS_PER_STEP = 4 // 4ms fixed timestep for physics

// === Spring Physics ===
export function spring(pos, v = 0, k = 290, b = 24) {
  return { pos, dest: pos, v, k, b }
}

export function springStep(s) {
  const t = MS_PER_STEP / 1000
  const Fspring = -s.k * (s.pos - s.dest)
  const Fdamper = -s.b * s.v
  const a = Fspring + Fdamper
  s.v += a * t
  s.pos += s.v * t
}

export function springSnap(s) {
  s.pos = s.dest
  s.v = 0
}

export function springAtRest(s) {
  return Math.abs(s.v) < 0.01 && Math.abs(s.dest - s.pos) < 0.01
}

// === Pointer Buffer ===
export function createPointerBuffer() {
  return [{ x: 0, y: 0, time: 0 }]
}

export function pushPointer(buffer, x, y, time) {
  buffer.push({ x, y, time })
  if (buffer.length > 20) buffer.shift()
}

export function clearPointer(buffer) {
  buffer.length = 0
  buffer.push({ x: 0, y: 0, time: 0 })
}

export function getVelocity(buffer, now, windowMs = 100) {
  if (buffer.length < 2) return { vx: 0, vy: 0 }
  const last = buffer[buffer.length - 1]
  let i = buffer.length - 1
  while (i > 0 && now - buffer[i].time <= windowMs) i--
  const deltaTime = now - buffer[i].time
  if (deltaTime < 1) return { vx: 0, vy: 0 }
  return {
    vx: (last.x - buffer[i].x) / deltaTime * 1000,
    vy: (last.y - buffer[i].y) / deltaTime * 1000
  }
}

// === Demo Factory ===
// Creates a demo with chenglou-style render loop
export function createDemo(config) {
  const {
    canvas,        // demo container element
    onRender,      // (ctx) => stillAnimating
    onCleanup,     // optional cleanup function
  } = config

  if (!canvas) return null

  // Event collection (not processed immediately)
  const events = {
    pointerdown: null,
    pointermove: null,
    pointerup: null,
    pointercancel: null,
  }

  // Scheduling
  let scheduledRender = false
  let animatedUntilTime = null

  function scheduleRender() {
    if (scheduledRender) return
    scheduledRender = true
    requestAnimationFrame(function renderAndMaybeScheduleAnotherRender(now) {
      scheduledRender = false
      if (render(now)) scheduleRender()
    })
  }

  // Main render function
  function render(now) {
    // Context passed to onRender
    const ctx = {
      now,
      events,
      pointer: { ...events.pointermove || events.pointerdown || { x: 0, y: 0 } },

      // Physics stepper
      stepSprings(springs) {
        let newAnimatedUntilTime = animatedUntilTime ?? now
        const steps = Math.floor((now - newAnimatedUntilTime) / MS_PER_STEP)
        newAnimatedUntilTime += steps * MS_PER_STEP

        let stillAnimating = false
        for (const s of springs) {
          for (let i = 0; i < steps; i++) springStep(s)
          if (springAtRest(s)) springSnap(s)
          else stillAnimating = true
        }

        animatedUntilTime = stillAnimating ? newAnimatedUntilTime : null
        return stillAnimating
      },

      // Reduced motion check
      prefersReducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false,
    }

    // Call user's render function
    const stillAnimating = onRender(ctx)

    // Clear events after processing
    events.pointerdown = null
    events.pointermove = null
    events.pointerup = null
    events.pointercancel = null

    return stillAnimating
  }

  // Event listeners
  function onPointerDown(e) {
    const rect = canvas.getBoundingClientRect()
    events.pointerdown = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      clientX: e.clientX,
      clientY: e.clientY,
      pointerId: e.pointerId,
    }
    canvas.setPointerCapture(e.pointerId)
    e.preventDefault()
    scheduleRender()
  }

  function onPointerMove(e) {
    const rect = canvas.getBoundingClientRect()
    events.pointermove = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      clientX: e.clientX,
      clientY: e.clientY,
      pointerId: e.pointerId,
    }
    scheduleRender()
  }

  function onPointerUp(e) {
    const rect = canvas.getBoundingClientRect()
    events.pointerup = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      clientX: e.clientX,
      clientY: e.clientY,
      pointerId: e.pointerId,
    }
    try { canvas.releasePointerCapture(e.pointerId) } catch {}
    scheduleRender()
  }

  function onPointerCancel(e) {
    events.pointercancel = { pointerId: e.pointerId }
    try { canvas.releasePointerCapture(e.pointerId) } catch {}
    scheduleRender()
  }

  // Attach listeners
  canvas.addEventListener('pointerdown', onPointerDown, { passive: false })
  canvas.addEventListener('pointermove', onPointerMove, { passive: false })
  canvas.addEventListener('pointerup', onPointerUp, { passive: false })
  canvas.addEventListener('pointercancel', onPointerCancel, { passive: false })

  // Initial render
  scheduleRender()

  // Cleanup function
  return function cleanup() {
    canvas.removeEventListener('pointerdown', onPointerDown)
    canvas.removeEventListener('pointermove', onPointerMove)
    canvas.removeEventListener('pointerup', onPointerUp)
    canvas.removeEventListener('pointercancel', onPointerCancel)
    onCleanup?.()
  }
}

// === Gesture Constants ===
export const GESTURE = {
  TOUCH_SLOP: 10,           // px before drag recognized
  LONG_PRESS_MS: 400,       // ms for long press
  TAP_MAX_MS: 300,          // max ms for tap
  DOUBLE_TAP_MS: 300,       // window for double tap
  DOUBLE_TAP_DISTANCE: 25,  // max px between taps
  VELOCITY_WINDOW_MS: 100,  // ms for velocity calculation
}

// === Spring Presets ===
export const SPRING = {
  DEFAULT: { k: 290, b: 24 },
  GENTLE: { k: 170, b: 26 },
  WOBBLY: { k: 180, b: 12 },
  STIFF: { k: 400, b: 28 },
  SLOW: { k: 120, b: 14 },
}

// === Utility ===
export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v))
}

export function lerp(a, b, t) {
  return a + (b - a) * t
}

export function rubber(distance, range) {
  return (distance * 0.55 * range) / (range + 0.55 * distance)
}
