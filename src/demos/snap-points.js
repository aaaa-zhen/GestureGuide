// Fling & Snap — Decay-targeted critically damped spring picker
// On release: exponential decay predicts natural resting position,
// round to nearest snap point, then critically damped spring drives there.
// This feels more natural than linear throw estimation.

import { clamp } from '../engine/render-loop.js'
import { onResize } from '../engine/lifecycle.js'

const MS_PER_STEP = 4

// 3D wheel geometry
const ANGLE_PER_ITEM = 22
const RADIUS = 130
const PIXELS_PER_ITEM = 44
const DEG_TO_RAD = Math.PI / 180

const ITEMS = [
  { icon: 'TYO', label: 'Tokyo' },
  { icon: 'PAR', label: 'Paris' },
  { icon: 'LON', label: 'London' },
  { icon: 'NYC', label: 'New York' },
  { icon: 'BER', label: 'Berlin' },
  { icon: 'SYD', label: 'Sydney' },
  { icon: 'SIN', label: 'Singapore' },
  { icon: 'DXB', label: 'Dubai' },
  { icon: 'ROM', label: 'Rome' },
  { icon: 'SEL', label: 'Seoul' },
  { icon: 'BCN', label: 'Barcelona' },
  { icon: 'SFO', label: 'San Francisco' },
  { icon: 'IST', label: 'Istanbul' },
  { icon: 'BKK', label: 'Bangkok' },
  { icon: 'AMS', label: 'Amsterdam' },
  { icon: 'MEX', label: 'Mexico City' },
  { icon: 'MOS', label: 'Moscow' },
  { icon: 'CAI', label: 'Cairo' },
  { icon: 'LIS', label: 'Lisbon' },
  { icon: 'VIE', label: 'Vienna' },
  { icon: 'PRG', label: 'Prague' },
  { icon: 'BUE', label: 'Buenos Aires' },
  { icon: 'CPT', label: 'Cape Town' },
  { icon: 'HKG', label: 'Hong Kong' },
  { icon: 'TPE', label: 'Taipei' },
  { icon: 'SHA', label: 'Shanghai' },
  { icon: 'MUM', label: 'Mumbai' },
  { icon: 'JKT', label: 'Jakarta' },
  { icon: 'LAX', label: 'Los Angeles' },
  { icon: 'CHI', label: 'Chicago' },
]

// Physics parameters
const DECAY_RATE = 0.998
const SPRING_K = 200
const DAMPING_RATIO = 1.0  // critically damped
const BOUNCE_K = 320
const BOUNCE_B = 30

const FLING_LOOKBACK_MS = 120
const FLING_VELOCITY_CLAMP = 4000
const FLING_MIN_VELOCITY = 80

function springB() { return 2 * DAMPING_RATIO * Math.sqrt(SPRING_K) }

export function initSnapPoints() {
  const demo = document.getElementById('demo-snap')
  if (!demo) return

  // Hide pre-defined HTML elements
  const oldTrack = demo.querySelector('.snap-track')
  const oldDot = demo.querySelector('.snap-dot')
  if (oldTrack) oldTrack.style.display = 'none'
  if (oldDot) oldDot.style.display = 'none'

  const readout = document.getElementById('snap-readout')
  const hint = document.getElementById('hint-snap')

  // === Build DOM ===
  const picker = document.createElement('div')
  picker.style.cssText = `
    position:absolute; top:50%; left:50%; transform:translate(-50%,-50%);
    width:min(220px, calc(100% - 48px)); height:calc(100% - 48px);
    border-radius:12px; border:1px solid var(--border);
    background:var(--surface); overflow:hidden;
    touch-action:none; cursor:grab;
  `
  demo.appendChild(picker)

  const wheel = document.createElement('div')
  wheel.style.cssText = `
    position:absolute; top:50%; left:0; right:0; height:0;
    transform-style:preserve-3d; pointer-events:none;
  `
  picker.appendChild(wheel)

  const itemEls = ITEMS.map(({ icon, label }) => {
    const el = document.createElement('div')
    el.style.cssText = `
      position:absolute; width:100%; height:${PIXELS_PER_ITEM}px; top:${-PIXELS_PER_ITEM / 2}px;
      display:flex; align-items:center; justify-content:center; gap:10px;
      font:500 0.85rem var(--font-mono); color:var(--fg);
      letter-spacing:-0.3px;
      backface-visibility:hidden; -webkit-backface-visibility:hidden;
      will-change:transform;
    `
    const iconSpan = document.createElement('span')
    iconSpan.style.cssText = `
      font-size:0.6rem; font-weight:700; letter-spacing:0.08em;
      color:var(--fg-muted); width:32px; text-align:center;
    `
    iconSpan.textContent = icon
    const labelSpan = document.createElement('span')
    labelSpan.style.cssText = 'width:100px;'
    labelSpan.textContent = label
    el.appendChild(iconSpan)
    el.appendChild(labelSpan)
    wheel.appendChild(el)
    return el
  })

  const indicator = document.createElement('div')
  indicator.style.cssText = `
    position:absolute; top:50%; left:8px; right:8px;
    height:${PIXELS_PER_ITEM}px; margin-top:${-PIXELS_PER_ITEM / 2}px;
    background:transparent; pointer-events:none; z-index:2;
    border-top:1px solid var(--accent); border-bottom:1px solid var(--accent);
    opacity:0.35;
  `
  picker.appendChild(indicator)

  const fadeTop = document.createElement('div')
  fadeTop.style.cssText = `
    position:absolute; top:0; left:0; right:0; height:40%;
    background:linear-gradient(to bottom, var(--surface) 10%, transparent);
    pointer-events:none; z-index:3;
  `
  picker.appendChild(fadeTop)

  const fadeBottom = document.createElement('div')
  fadeBottom.style.cssText = `
    position:absolute; bottom:0; left:0; right:0; height:40%;
    background:linear-gradient(to top, var(--surface) 10%, transparent);
    pointer-events:none; z-index:3;
  `
  picker.appendChild(fadeBottom)

  // === State ===
  const maxScroll = 0
  const minScroll = -(ITEMS.length - 1) * PIXELS_PER_ITEM

  let pos = 0
  let vel = 0
  let dest = 0
  let phase = 'idle' // 'idle' | 'drag' | 'spring' | 'bounce'
  let animatedUntilTime = null

  let dragging = false
  let rawDragScroll = 0
  let lastPointerY = 0
  let pointerHistory = []
  let lastSelectedIdx = -1

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

  // === Helpers ===
  function snapToItem(p) {
    const idx = Math.round(-p / PIXELS_PER_ITEM)
    return -clamp(idx, 0, ITEMS.length - 1) * PIXELS_PER_ITEM
  }

  function getSelectedIndex() {
    return clamp(Math.round(-pos / PIXELS_PER_ITEM), 0, ITEMS.length - 1)
  }

  // === Decay target calculation ===
  // Exponential decay: pos_final = pos + v / (1 - decayRate)
  // This predicts where a natural fling would come to rest
  function decayFinalPos(startPos, v_px_s) {
    const v_ms = v_px_s / 1000
    return startPos + v_ms / (1 - DECAY_RATE)
  }

  // === Critically damped spring step ===
  function springStep(dtMs) {
    const dt = dtMs / 1000
    const b = springB()
    const F = -SPRING_K * (pos - dest) - b * vel
    vel += F * dt
    pos += vel * dt
  }

  // === Bounce step (spring to edge) ===
  function bounceStep(dtMs) {
    const dt = dtMs / 1000
    const edge = pos > maxScroll ? maxScroll : minScroll
    const F = -BOUNCE_K * (pos - edge) - BOUNCE_B * vel
    vel += F * dt
    pos += vel * dt
  }

  // === Rubber band (for drag visual) ===
  function rubberBand(offset, dim) {
    const abs = Math.abs(offset)
    const norm = abs * 0.55 / dim
    return Math.sign(offset) * (1 - 1 / (norm + 1)) * dim
  }

  function applyRubberBand(p) {
    const dim = Math.max(1, picker.clientHeight)
    if (p > maxScroll) return maxScroll + rubberBand(p - maxScroll, dim)
    if (p < minScroll) return minScroll + rubberBand(p - minScroll, dim)
    return p
  }

  function dampDragDelta(curPos, dy) {
    const beyond = curPos > maxScroll || curPos < minScroll
    if (!beyond) return dy
    const goingFurther = (curPos > maxScroll && dy > 0) || (curPos < minScroll && dy < 0)
    if (!goingFurther) return dy
    const edge = curPos > maxScroll ? maxScroll : minScroll
    const ov = Math.abs(curPos - edge)
    const dim = Math.max(1, picker.clientHeight)
    return dy / (1 + ov / (dim * 0.52))
  }

  // === Velocity tracking ===
  function calculateReleaseVelocity() {
    if (pointerHistory.length < 2) return 0
    const latest = pointerHistory[pointerHistory.length - 1]
    let i = pointerHistory.length - 2
    while (i > 0 && latest.time - pointerHistory[i].time < FLING_LOOKBACK_MS) i--
    const first = pointerHistory[i]
    const dt = latest.time - first.time
    if (dt <= 0) return 0
    return clamp((latest.y - first.y) / dt * 1000, -FLING_VELOCITY_CLAMP, FLING_VELOCITY_CLAMP)
  }

  // === Fling: decay predicts target, spring animates ===
  function startFlingSpring(fromPos, v_px_s) {
    const naturalStop = decayFinalPos(fromPos, v_px_s)
    dest = snapToItem(clamp(naturalStop, minScroll, maxScroll))
    vel = v_px_s
    phase = 'spring'
  }

  // === 3D wheel visuals ===
  function updateWheelVisuals(scrollPos) {
    for (let i = 0; i < itemEls.length; i++) {
      const angle = -(i + scrollPos / PIXELS_PER_ITEM) * ANGLE_PER_ITEM
      const el = itemEls[i]
      if (Math.abs(angle) > 88) {
        el.style.visibility = 'hidden'
        continue
      }
      el.style.visibility = 'visible'
      el.style.transform = `rotateX(${angle}deg) translateZ(${RADIUS}px)`
      el.style.opacity = String(Math.max(0, Math.cos(angle * DEG_TO_RAD)))
    }
    const idx = getSelectedIndex()
    if (idx !== lastSelectedIdx) {
      lastSelectedIdx = idx
    }
  }

  // === Finish drag ===
  function finishDrag() {
    if (!dragging) return
    dragging = false

    const fv = calculateReleaseVelocity()
    animatedUntilTime = null

    if (pos > maxScroll || pos < minScroll) {
      // Overscrolled — collapse rubber band, bounce back
      pos = applyRubberBand(pos)
      vel = fv * 0.3
      phase = 'bounce'
    } else if (Math.abs(fv) < FLING_MIN_VELOCITY) {
      // Slow release — spring to nearest
      vel = fv
      dest = snapToItem(pos)
      phase = 'spring'
    } else {
      // Fling — decay predicts target, spring drives there
      startFlingSpring(pos, fv)
    }

    const targetIdx = clamp(Math.round(-dest / PIXELS_PER_ITEM), 0, ITEMS.length - 1)
    readout.innerHTML =
      `v = <span class="val">${Math.round(fv)} px/s</span> ` +
      `decay \u2192 <span class="val">${ITEMS[targetIdx].label}</span>`

    scheduleRender()
  }

  // === Events ===
  // Pointer capture sends move/up to the capturing element, so we listen on
  // picker (primary) + window (fallback for edge cases).
  picker.addEventListener('pointerdown', (e) => {
    if (dragging) return
    e.preventDefault()
    dragging = true
    phase = 'drag'
    lastPointerY = e.pageY
    pointerHistory = [{ y: e.pageY, time: performance.now() }]
    rawDragScroll = pos
    vel = 0
    animatedUntilTime = null
    picker.setPointerCapture(e.pointerId)
    picker.style.cursor = 'grabbing'
    if (hint) hint.style.display = 'none'
    scheduleRender()
  }, { passive: false })

  function onPointerMove(e) {
    if (!dragging) return
    const dy = e.pageY - lastPointerY
    lastPointerY = e.pageY
    pointerHistory.push({ y: e.pageY, time: performance.now() })
    if (pointerHistory.length > 20) pointerHistory.shift()
    rawDragScroll += dampDragDelta(rawDragScroll, dy)
    pos = rawDragScroll
    scheduleRender()
  }

  function onPointerUp() {
    if (!dragging) return
    picker.style.cursor = 'grab'
    finishDrag()
  }

  picker.addEventListener('pointermove', onPointerMove)
  picker.addEventListener('pointerup', onPointerUp)
  picker.addEventListener('pointercancel', onPointerUp)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerUp)

  // Wheel — step by items based on delta direction, spring animate
  let wheelAccum = 0
  picker.addEventListener('wheel', (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (hint) hint.style.display = 'none'

    // Accumulate delta for high-resolution trackpads
    wheelAccum += e.deltaY
    const stepThreshold = 40
    const steps = Math.trunc(wheelAccum / stepThreshold)
    if (steps === 0) return
    wheelAccum -= steps * stepThreshold

    // Move target by N items from current target
    const currentTargetIdx = phase === 'spring'
      ? Math.round(-dest / PIXELS_PER_ITEM)
      : Math.round(-pos / PIXELS_PER_ITEM)
    const newIdx = clamp(currentTargetIdx + steps, 0, ITEMS.length - 1)
    dest = -newIdx * PIXELS_PER_ITEM
    vel = -steps * 300
    phase = 'spring'
    if (!animatedUntilTime) animatedUntilTime = performance.now()
    scheduleRender()
  }, { passive: false })

  // Keyboard
  demo.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      if (hint) hint.style.display = 'none'
      const idx = getSelectedIndex()
      vel = 0
      animatedUntilTime = null
      if (e.key === 'ArrowUp' && idx > 0) {
        dest = -(idx - 1) * PIXELS_PER_ITEM
      } else if (e.key === 'ArrowDown' && idx < ITEMS.length - 1) {
        dest = -(idx + 1) * PIXELS_PER_ITEM
      }
      phase = 'spring'
      scheduleRender()
    }
  })

  // === Main render ===
  function render(now) {
    let newAnimTime = animatedUntilTime ?? now
    const steps = Math.floor((now - newAnimTime) / MS_PER_STEP)
    newAnimTime += steps * MS_PER_STEP

    if (!dragging && steps > 0) {
      for (let i = 0; i < steps; i++) {
        if (phase === 'spring') {
          springStep(MS_PER_STEP)

          if (pos > maxScroll || pos < minScroll) {
            phase = 'bounce'
            continue
          }

          if (Math.abs(vel) < 0.05 && Math.abs(pos - dest) < 0.05) {
            pos = dest
            vel = 0
            phase = 'idle'
          }
        } else if (phase === 'bounce') {
          bounceStep(MS_PER_STEP)

          if (pos >= minScroll && pos <= maxScroll) {
            dest = snapToItem(pos)
            phase = 'spring'
          }
        }
      }
    }

    const stillAnimating = !dragging && phase !== 'idle'

    const visualPos = dragging ? applyRubberBand(pos) : pos
    updateWheelVisuals(visualPos)

    // Readout
    const idx = getSelectedIndex()
    if (dragging) {
      readout.innerHTML = `<span class="val">${ITEMS[idx].label}</span>`
    } else if (phase === 'idle') {
      readout.innerHTML = `<span class="val">${ITEMS[idx].label}</span>`
    }

    animatedUntilTime = stillAnimating || dragging ? newAnimTime : null
    return stillAnimating || dragging
  }

  scheduleRender()
  onResize(() => scheduleRender())
}

// Auto-init
if (document.getElementById('demo-snap')) {
  initSnapPoints()
}
