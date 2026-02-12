// Rope Pull — dark/light theme toggle
// Pure rope dangling from top-right. Pull down to switch theme.
// Commit happens on RELEASE, not during drag — interruptible like swipe-to-dismiss.

import { onCleanup } from '../engine/lifecycle.js'

const SEGMENT_COUNT = 8
const GRAVITY = 0.45
const DAMPING = 0.985
const ITERATIONS = 3
const ROPE_REST_LENGTH = 12
const TRIGGER_THRESHOLD = 15 // px past rest position to commit on release

export function initRopePull() {
  const canvas = document.getElementById('rope-toggle')
  if (!canvas) return
  const ctx = canvas.getContext('2d')

  const dpr = Math.ceil(window.devicePixelRatio || 1)
  const W = 50
  const H = 140

  canvas.style.width = W + 'px'
  canvas.style.height = H + 'px'
  canvas.width = W * dpr
  canvas.height = H * dpr
  ctx.scale(dpr, dpr)

  const anchorX = W / 2
  const anchorY = 0
  const restY = SEGMENT_COUNT * ROPE_REST_LENGTH // where tip rests naturally

  const points = []
  for (let i = 0; i <= SEGMENT_COUNT; i++) {
    points.push({
      x: anchorX,
      y: anchorY + i * ROPE_REST_LENGTH,
      oldX: anchorX,
      oldY: anchorY + i * ROPE_REST_LENGTH,
      pinned: i === 0
    })
  }

  const sticks = []
  for (let i = 0; i < SEGMENT_COUNT; i++) {
    sticks.push({ p0: points[i], p1: points[i + 1], length: ROPE_REST_LENGTH })
  }

  const tip = points[points.length - 1]

  let dragging = false
  let pointerId = null
  let rafId = 0
  let settledCount = 0

  function isDark() {
    return document.documentElement.getAttribute('data-theme') === 'dark'
  }

  function updateA11yState() {
    canvas.setAttribute('aria-checked', isDark() ? 'true' : 'false')
  }

  function toggleTheme() {
    const html = document.documentElement
    const next = isDark() ? 'light' : 'dark'
    html.setAttribute('data-theme', next)
    localStorage.setItem('theme', next)
    updateA11yState()
  }

  // ── Physics ──

  function updatePhysics() {
    for (const p of points) {
      if (p.pinned) continue
      if (dragging && p === tip) continue
      const vx = (p.x - p.oldX) * DAMPING
      const vy = (p.y - p.oldY) * DAMPING
      p.oldX = p.x
      p.oldY = p.y
      p.x += vx
      p.y += vy + GRAVITY
      p.x = Math.max(2, Math.min(W - 2, p.x))
      p.y = Math.max(0, Math.min(H - 4, p.y))
    }

    for (let it = 0; it < ITERATIONS; it++) {
      for (const s of sticks) {
        const dx = s.p1.x - s.p0.x
        const dy = s.p1.y - s.p0.y
        const dist = Math.hypot(dx, dy) || 0.001
        const diff = s.length - dist
        const w0 = s.p0.pinned ? 0 : 1
        const w1 = (s.p1.pinned || (dragging && s.p1 === tip)) ? 0 : 1
        const wSum = w0 + w1
        if (!wSum) continue
        const f = diff / (dist * wSum)
        const ox = dx * f
        const oy = dy * f
        if (w0) { s.p0.x -= ox; s.p0.y -= oy }
        if (w1) { s.p1.x += ox; s.p1.y += oy }
      }
    }
  }

  // ── Draw ──

  // Align coordinate to pixel grid for sharper lines
  function px(v) {
    return Math.round(v * dpr) / dpr
  }

  function draw() {
    ctx.clearRect(0, 0, W, H)
    const dark = isDark()
    const pullY = Math.max(0, tip.y - restY)
    const progress = Math.min(1, pullY / TRIGGER_THRESHOLD)

    // Rope color shifts toward accent when near trigger
    const baseColor = dark ? '#555' : '#bbb'
    const hotColor = dark ? '#f0a030' : '#5a9cf5'

    // Interpolate color
    let ropeColor = baseColor
    if (progress > 0.3) {
      const t = (progress - 0.3) / 0.7
      ropeColor = lerpColor(baseColor, hotColor, t)
    }

    ctx.strokeStyle = ropeColor
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    // Catmull-Rom → cubic bezier for smooth arcs even with few points
    ctx.beginPath()
    ctx.moveTo(px(points[0].x), px(points[0].y))

    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(i - 1, 0)]
      const p1 = points[i]
      const p2 = points[i + 1]
      const p3 = points[Math.min(i + 2, points.length - 1)]

      // Catmull-Rom tangents (tension = 0 → uniform)
      const t = 1 / 3
      const cp1x = p1.x + (p2.x - p0.x) * t
      const cp1y = p1.y + (p2.y - p0.y) * t
      const cp2x = p2.x - (p3.x - p1.x) * t
      const cp2y = p2.y - (p3.y - p1.y) * t

      ctx.bezierCurveTo(px(cp1x), px(cp1y), px(cp2x), px(cp2y), px(p2.x), px(p2.y))
    }
    ctx.stroke()
  }

  function lerpColor(a, b, t) {
    const pa = parseColor(a)
    const pb = parseColor(b)
    const r = Math.round(pa[0] + (pb[0] - pa[0]) * t)
    const g = Math.round(pa[1] + (pb[1] - pa[1]) * t)
    const bl = Math.round(pa[2] + (pb[2] - pa[2]) * t)
    return `rgb(${r},${g},${bl})`
  }

  function parseColor(hex) {
    const h = hex.replace('#', '')
    return [
      parseInt(h.substring(0, 2), 16),
      parseInt(h.substring(2, 4), 16),
      parseInt(h.substring(4, 6), 16)
    ]
  }

  // ── Animation loop ──

  function isSettled() {
    let total = 0
    for (const p of points) {
      if (p.pinned) continue
      total += Math.abs(p.x - p.oldX) + Math.abs(p.y - p.oldY)
    }
    return total < 0.01
  }

  function frame() {
    updatePhysics()
    draw()

    if (!dragging && isSettled()) {
      settledCount++
      if (settledCount > 60) { rafId = 0; return }
    } else {
      settledCount = 0
    }

    rafId = requestAnimationFrame(frame)
  }

  function ensureRunning() {
    settledCount = 0
    if (!rafId) rafId = requestAnimationFrame(frame)
  }

  // ── Pointer events ──

  function getPos(e) {
    const r = canvas.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  let dragStartY = 0
  let dragStartTipY = 0

  function applyResistance(delta, maxDelta) {
    // Rubber-band drag resistance: diminishing returns the further you pull
    const ratio = Math.min(Math.abs(delta) / maxDelta, 1)
    const resistance = 1 - 0.55 * ratio
    return delta * resistance
  }

  function onPointerMove(e) {
    if (!dragging || e.pointerId !== pointerId) return
    const pos = getPos(e)
    tip.x = Math.max(4, Math.min(W - 4, pos.x))

    // Apply drag resistance on the Y axis past the rest position
    const rawDeltaY = pos.y - dragStartY
    const maxStretch = H - restY
    if (rawDeltaY > 0 && dragStartTipY + rawDeltaY > restY) {
      const pastRest = dragStartTipY + rawDeltaY - restY
      const resistedPast = applyResistance(pastRest, maxStretch)
      tip.y = Math.max(0, Math.min(H - 4, restY + resistedPast))
    } else {
      tip.y = Math.max(0, Math.min(H - 4, dragStartTipY + rawDeltaY))
    }

    tip.oldX = tip.x
    tip.oldY = tip.y
    e.preventDefault()
    ensureRunning()
  }

  function onPointerDown(e) {
    const pos = getPos(e)
    const d = Math.hypot(pos.x - tip.x, pos.y - tip.y)
    if (d < 30) {
      dragging = true
      pointerId = e.pointerId
      canvas.setPointerCapture(e.pointerId)
      dragStartY = pos.y
      dragStartTipY = tip.y
      tip.x = pos.x
      tip.y = pos.y
      tip.oldX = tip.x
      tip.oldY = tip.y
      e.preventDefault()
      ensureRunning()
    }
  }

  function endDrag(e) {
    if (!dragging || e.pointerId !== pointerId) return
    dragging = false
    pointerId = null
    try { canvas.releasePointerCapture(e.pointerId) } catch {}

    // ── Commit-on-release: check position at the moment of release ──
    const pullY = tip.y - restY
    if (pullY > TRIGGER_THRESHOLD) {
      toggleTheme()
    }

    // Add lateral perturbation so rope swings back in an arc, not a straight line
    const side = (tip.x > anchorX) ? -1 : 1
    for (let i = 1; i < points.length; i++) {
      const t = i / points.length
      const strength = Math.sin(t * Math.PI) * 3.5
      points[i].oldX = points[i].x - side * strength
    }

    ensureRunning()
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      toggleTheme()
      ensureRunning()
    }
  }

  canvas.addEventListener('pointerdown', onPointerDown, { passive: false })
  canvas.addEventListener('keydown', onKeyDown)

  // Listen on both canvas (with capture) and window (as fallback)
  canvas.addEventListener('pointermove', onPointerMove, { passive: false })
  window.addEventListener('pointermove', onPointerMove, { passive: false })

  canvas.addEventListener('pointerup', endDrag, { passive: false })
  canvas.addEventListener('pointercancel', endDrag, { passive: false })
  window.addEventListener('pointerup', endDrag, { passive: false })
  window.addEventListener('pointercancel', endDrag, { passive: false })

  // Initial render
  updateA11yState()
  ensureRunning()

  onCleanup(() => {
    canvas.removeEventListener('pointerdown', onPointerDown)
    canvas.removeEventListener('keydown', onKeyDown)
    canvas.removeEventListener('pointermove', onPointerMove)
    canvas.removeEventListener('pointerup', endDrag)
    canvas.removeEventListener('pointercancel', endDrag)
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', endDrag)
    window.removeEventListener('pointercancel', endDrag)
    if (rafId) {
      cancelAnimationFrame(rafId)
      rafId = 0
    }
  })
}
