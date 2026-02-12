// Rough.js diagrams for Chapter 5 — System Integration

import rough from 'roughjs'

const FONT = '"JetBrains Mono", "SF Mono", monospace'
const COLORS = {
  red: '#e74c3c',
  green: '#27ae60',
  blue: '#2b5ce6',
  purple: '#7040b0',
  orange: '#d4820a',
  fg: '#1a1a1a',
  muted: '#8a8a9a',
  border: '#d0d0d0',
  accent: '#2b5ce6',
}

function createSvg(container, width, height, label) {
  const existing = container.querySelector('svg')
  if (existing) existing.remove()

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
  svg.setAttribute('role', 'img')
  if (label) svg.setAttribute('aria-label', label)
  svg.style.width = '100%'
  svg.style.height = 'auto'
  container.appendChild(svg)
  return svg
}

function addText(svg, x, y, text, opts = {}) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'text')
  el.setAttribute('x', x)
  el.setAttribute('y', y)
  el.setAttribute('font-family', FONT)
  el.setAttribute('font-size', opts.size || 11)
  el.setAttribute('fill', opts.color || COLORS.fg)
  if (opts.anchor) el.setAttribute('text-anchor', opts.anchor)
  if (opts.weight) el.setAttribute('font-weight', opts.weight)
  el.textContent = text
  svg.appendChild(el)
  return el
}

function addArrowhead(svg, x, y, angle, color) {
  const size = 6
  const a1 = angle + Math.PI * 0.82
  const a2 = angle - Math.PI * 0.82
  const p1x = x + size * Math.cos(a1)
  const p1y = y + size * Math.sin(a1)
  const p2x = x + size * Math.cos(a2)
  const p2y = y + size * Math.sin(a2)
  const ah = document.createElementNS('http://www.w3.org/2000/svg', 'polygon')
  ah.setAttribute('points', `${p1x},${p1y} ${x},${y} ${p2x},${p2y}`)
  ah.setAttribute('fill', color)
  svg.appendChild(ah)
}

// ─── STATE MACHINE DIAGRAM ───
// Full state machine: IDLE → PRESSED → DRAGGING / TAP / LONG_PRESS → FLING → IDLE
export function drawStateMachineDiagram(containerId) {
  const container = document.getElementById(containerId)
  if (!container) return

  const W = 620, H = 340
  const svg = createSvg(container, W, H, 'Gesture state machine: IDLE transitions to PRESSED on pointer down, PRESSED branches to TAP on quick release, DRAGGING on movement exceeding slop, or LONG PRESS on timer. DRAGGING transitions to FLING on fast release or back to IDLE on slow release. All terminal states return to IDLE.')
  const rc = rough.svg(svg)

  // State positions
  const states = {
    idle:      { x: 40,  y: 140, w: 80,  h: 40, color: COLORS.accent, label: 'IDLE' },
    pressed:   { x: 200, y: 140, w: 100, h: 40, color: COLORS.orange, label: 'PRESSED' },
    tap:       { x: 420, y: 30,  w: 80,  h: 40, color: COLORS.green,  label: 'TAP' },
    longpress: { x: 420, y: 140, w: 130, h: 40, color: COLORS.purple, label: 'LONG PRESS' },
    dragging:  { x: 420, y: 250, w: 100, h: 40, color: COLORS.blue,   label: 'DRAGGING' },
    fling:     { x: 250, y: 280, w: 80,  h: 40, color: COLORS.red,    label: 'FLING' },
  }

  // Draw state boxes
  for (const [, s] of Object.entries(states)) {
    svg.appendChild(rc.rectangle(s.x, s.y, s.w, s.h, {
      fill: s.color + '12', fillStyle: 'solid',
      stroke: s.color, roughness: 0.7, strokeWidth: 1.5,
    }))
    addText(svg, s.x + s.w / 2, s.y + s.h / 2 + 4, s.label, {
      size: 11, color: s.color, anchor: 'middle', weight: 700,
    })
  }

  // Helper: draw arrow between two state rects
  function arrow(from, to, label, color, yOff) {
    const fx = from.x + from.w
    const fy = from.y + from.h / 2 + (yOff || 0)
    const tx = to.x
    const ty = to.y + to.h / 2 + (yOff || 0)
    svg.appendChild(rc.line(fx + 4, fy, tx - 8, ty, {
      stroke: color, roughness: 0.5, strokeWidth: 1.2,
    }))
    const ah = document.createElementNS('http://www.w3.org/2000/svg', 'polygon')
    ah.setAttribute('points', `${tx - 8},${ty - 4} ${tx},${ty} ${tx - 8},${ty + 4}`)
    ah.setAttribute('fill', color)
    svg.appendChild(ah)
    // Label midpoint
    const mx = (fx + tx) / 2
    const my = (fy + ty) / 2 - 8
    addText(svg, mx, my, label, { size: 9, color, anchor: 'middle' })
  }

  // IDLE → PRESSED
  arrow(states.idle, states.pressed, 'pointerdown', COLORS.fg)

  // PRESSED → TAP (diagonal up-right)
  svg.appendChild(rc.line(302, 145, 416, 58, {
    stroke: COLORS.green, roughness: 0.6, strokeWidth: 1.2,
  }))
  const a1 = document.createElementNS('http://www.w3.org/2000/svg', 'polygon')
  a1.setAttribute('points', '412,50 422,56 414,64')
  a1.setAttribute('fill', COLORS.green)
  svg.appendChild(a1)
  addText(svg, 345, 88, 'up < 300ms', { size: 9, color: COLORS.green, anchor: 'middle' })

  // PRESSED → LONG PRESS (horizontal right)
  arrow(states.pressed, states.longpress, 'hold > 400ms', COLORS.purple)

  // PRESSED → DRAGGING (diagonal down-right)
  svg.appendChild(rc.line(302, 175, 416, 262, {
    stroke: COLORS.blue, roughness: 0.6, strokeWidth: 1.2,
  }))
  const a2 = document.createElementNS('http://www.w3.org/2000/svg', 'polygon')
  a2.setAttribute('points', '414,256 422,264 412,270')
  a2.setAttribute('fill', COLORS.blue)
  svg.appendChild(a2)
  addText(svg, 345, 230, 'move > slop', { size: 9, color: COLORS.blue, anchor: 'middle' })

  // DRAGGING → FLING (left, down)
  svg.appendChild(rc.line(420, 285, 334, 298, {
    stroke: COLORS.red, roughness: 0.5, strokeWidth: 1.2,
  }))
  const a3 = document.createElementNS('http://www.w3.org/2000/svg', 'polygon')
  a3.setAttribute('points', '338,292 330,298 336,304')
  a3.setAttribute('fill', COLORS.red)
  svg.appendChild(a3)
  addText(svg, 382, 278, 'fast release', { size: 9, color: COLORS.red, anchor: 'middle' })

  // Return arrows to IDLE (curved, dashed)
  // TAP → IDLE
  svg.appendChild(rc.line(420, 35, 80, 135, {
    stroke: COLORS.muted, roughness: 0.5, strokeWidth: 0.8, strokeLineDash: [5, 4],
  }))
  addText(svg, 220, 68, 'reset', { size: 8, color: COLORS.muted, anchor: 'middle' })

  // LONG PRESS → IDLE
  svg.appendChild(rc.line(420, 165, 122, 165, {
    stroke: COLORS.muted, roughness: 0.5, strokeWidth: 0.8, strokeLineDash: [5, 4],
  }))
  addText(svg, 270, 178, 'reset', { size: 8, color: COLORS.muted, anchor: 'middle' })

  // FLING → IDLE
  svg.appendChild(rc.line(250, 295, 80, 182, {
    stroke: COLORS.muted, roughness: 0.5, strokeWidth: 0.8, strokeLineDash: [5, 4],
  }))
  addText(svg, 148, 250, 'settled', { size: 8, color: COLORS.muted, anchor: 'middle' })

  // DRAGGING slow release → IDLE
  svg.appendChild(rc.line(420, 275, 80, 175, {
    stroke: COLORS.muted, roughness: 0.4, strokeWidth: 0.8, strokeLineDash: [5, 4],
  }))
  addText(svg, 230, 240, 'slow release', { size: 8, color: COLORS.muted, anchor: 'middle' })

  // "?" on PRESSED
  svg.appendChild(rc.circle(250, 125, 22, {
    fill: '#fff', fillStyle: 'solid',
    stroke: COLORS.orange, roughness: 0.8, strokeWidth: 1,
  }))
  addText(svg, 250, 129, '?', { size: 13, color: COLORS.orange, anchor: 'middle', weight: 700 })
}

// ─── NESTED SCROLL DIAGRAM ───
export function drawNestedScrollDiagram(containerId) {
  const container = document.getElementById(containerId)
  if (!container) return

  const W = 620, H = 260
  const svg = createSvg(container, W, H, 'Nested scroll containers: parent vertical scroller contains a child horizontal scroller. Scroll events propagate from inner to outer unless contained by overscroll-behavior.')
  const rc = rough.svg(svg)

  // Parent container (outer)
  svg.appendChild(rc.rectangle(60, 20, 300, 220, {
    fill: COLORS.blue + '08', fillStyle: 'solid',
    stroke: COLORS.blue, roughness: 0.7, strokeWidth: 1.5,
  }))
  addText(svg, 210, 15, 'PARENT (vertical)', { size: 10, color: COLORS.blue, anchor: 'middle', weight: 600 })

  // Vertical scroll arrow inside parent
  svg.appendChild(rc.line(340, 60, 340, 200, {
    stroke: COLORS.blue, roughness: 0.5, strokeWidth: 1.2, strokeLineDash: [4, 4],
  }))
  addArrowhead(svg, 340, 200, Math.PI / 2, COLORS.blue)
  addArrowhead(svg, 340, 60, -Math.PI / 2, COLORS.blue)

  // Child container (inner)
  svg.appendChild(rc.rectangle(90, 80, 220, 100, {
    fill: COLORS.orange + '10', fillStyle: 'solid',
    stroke: COLORS.orange, roughness: 0.7, strokeWidth: 1.5,
  }))
  addText(svg, 200, 75, 'CHILD (horizontal)', { size: 10, color: COLORS.orange, anchor: 'middle', weight: 600 })

  // Horizontal scroll arrow inside child
  svg.appendChild(rc.line(110, 155, 290, 155, {
    stroke: COLORS.orange, roughness: 0.5, strokeWidth: 1.2, strokeLineDash: [4, 4],
  }))
  addArrowhead(svg, 290, 155, 0, COLORS.orange)
  addArrowhead(svg, 110, 155, Math.PI, COLORS.orange)

  // Event flow explanation (right side)
  svg.appendChild(rc.rectangle(400, 30, 200, 60, {
    fill: COLORS.green + '08', fillStyle: 'solid',
    stroke: COLORS.green, roughness: 0.6, strokeWidth: 1,
  }))
  addText(svg, 500, 52, 'Child scrolling', { size: 10, color: COLORS.green, anchor: 'middle', weight: 600 })
  addText(svg, 500, 72, 'overscroll: contain', { size: 9, color: COLORS.muted, anchor: 'middle' })

  // Arrow from child end to parent
  svg.appendChild(rc.rectangle(400, 120, 200, 60, {
    fill: COLORS.red + '08', fillStyle: 'solid',
    stroke: COLORS.red, roughness: 0.6, strokeWidth: 1,
  }))
  addText(svg, 500, 142, 'Child at boundary', { size: 10, color: COLORS.red, anchor: 'middle', weight: 600 })
  addText(svg, 500, 162, 'scroll chains to parent', { size: 9, color: COLORS.muted, anchor: 'middle' })

  // Arrow between the two right boxes
  svg.appendChild(rc.line(500, 92, 500, 116, {
    stroke: COLORS.fg, roughness: 0.5, strokeWidth: 1.2,
  }))
  addArrowhead(svg, 500, 116, Math.PI / 2, COLORS.fg)
  addText(svg, 530, 108, 'boundary', { size: 8, color: COLORS.muted })

  // overscroll-behavior annotation
  svg.appendChild(rc.rectangle(400, 200, 200, 44, {
    fill: COLORS.purple + '08', fillStyle: 'solid',
    stroke: COLORS.purple, roughness: 0.6, strokeWidth: 1,
  }))
  addText(svg, 500, 218, 'overscroll-behavior:', { size: 9, color: COLORS.purple, anchor: 'middle', weight: 600 })
  addText(svg, 500, 234, 'contain | none | auto', { size: 9, color: COLORS.muted, anchor: 'middle' })
}

// ─── FIXED-STEP SIMULATION DIAGRAM ───
export function drawFixedStepDiagram(containerId) {
  const container = document.getElementById(containerId)
  if (!container) return

  const W = 620, H = 220
  const svg = createSvg(container, W, H, 'Fixed-step simulation: variable frame intervals on top row versus fixed 4ms physics steps on bottom row, with an accumulator bridging the two')
  const rc = rough.svg(svg)

  // Top row: variable frames
  addText(svg, 20, 30, 'FRAMES (variable)', { size: 10, color: COLORS.blue, weight: 600 })

  const frameXs = [60, 145, 215, 320, 385, 480, 570]
  const frameLabels = ['16ms', '12ms', '22ms', '16ms', '19ms', '16ms']

  for (let i = 0; i < frameXs.length; i++) {
    svg.appendChild(rc.line(frameXs[i], 42, frameXs[i], 68, {
      stroke: COLORS.blue, roughness: 0.5, strokeWidth: 1.5,
    }))
    if (i < frameXs.length - 1) {
      svg.appendChild(rc.line(frameXs[i], 55, frameXs[i + 1], 55, {
        stroke: COLORS.border, roughness: 0.3, strokeWidth: 0.8,
      }))
      const mx = (frameXs[i] + frameXs[i + 1]) / 2
      addText(svg, mx, 48, frameLabels[i], { size: 8, color: COLORS.muted, anchor: 'middle' })
    }
  }

  // Accumulator arrow
  svg.appendChild(rc.line(310, 75, 310, 105, {
    stroke: COLORS.fg, roughness: 0.5, strokeWidth: 1.2,
  }))
  addArrowhead(svg, 310, 105, Math.PI / 2, COLORS.fg)
  addText(svg, 340, 94, 'accumulator', { size: 9, color: COLORS.muted })

  // Bottom row: fixed steps (4ms each)
  addText(svg, 20, 130, 'PHYSICS (fixed 4ms)', { size: 10, color: COLORS.green, weight: 600 })

  const stepStart = 60
  const stepWidth = 16 // visual width per 4ms step
  const numSteps = 32

  for (let i = 0; i <= numSteps; i++) {
    const x = stepStart + i * stepWidth
    if (x > 575) break
    const isHeavy = i % 4 === 0
    svg.appendChild(rc.line(x, 140, x, isHeavy ? 168 : 158, {
      stroke: isHeavy ? COLORS.green : COLORS.green + '60',
      roughness: 0.3,
      strokeWidth: isHeavy ? 1.2 : 0.8,
    }))
  }

  // Baseline
  svg.appendChild(rc.line(stepStart, 152, stepStart + numSteps * stepWidth, 152, {
    stroke: COLORS.border, roughness: 0.3, strokeWidth: 0.8,
  }))

  // 4ms label
  svg.appendChild(rc.line(stepStart, 172, stepStart + stepWidth, 172, {
    stroke: COLORS.green, roughness: 0.3, strokeWidth: 0.8,
  }))
  svg.appendChild(rc.line(stepStart, 168, stepStart, 176, {
    stroke: COLORS.green, roughness: 0.3, strokeWidth: 0.8,
  }))
  svg.appendChild(rc.line(stepStart + stepWidth, 168, stepStart + stepWidth, 176, {
    stroke: COLORS.green, roughness: 0.3, strokeWidth: 0.8,
  }))
  addText(svg, stepStart + stepWidth / 2, 190, '4ms', { size: 9, color: COLORS.green, anchor: 'middle', weight: 600 })

  // Explanation
  addText(svg, 310, 212, 'Frame-rate independence: physics always advances in fixed 4ms steps', {
    size: 9, color: COLORS.muted, anchor: 'middle',
  })
}

// ─── REQUEST ANIMATION FRAME LOOP DIAGRAM ───
export function drawRafDiagram(containerId) {
  const container = document.getElementById(containerId)
  if (!container) return

  const W = 620, H = 240
  const svg = createSvg(container, W, H, 'requestAnimationFrame render loop: schedule calls rAF, which calls render on next vsync. Render checks if animation is still active and schedules again if needed, forming a loop.')
  const rc = rough.svg(svg)

  // Schedule box
  svg.appendChild(rc.rectangle(30, 80, 110, 50, {
    fill: COLORS.blue + '10', fillStyle: 'solid',
    stroke: COLORS.blue, roughness: 0.7, strokeWidth: 1.5,
  }))
  addText(svg, 85, 100, 'schedule()', { size: 10, color: COLORS.blue, anchor: 'middle', weight: 600 })
  addText(svg, 85, 116, 'deduplicated', { size: 8, color: COLORS.muted, anchor: 'middle' })

  // rAF box
  svg.appendChild(rc.rectangle(200, 80, 140, 50, {
    fill: COLORS.orange + '10', fillStyle: 'solid',
    stroke: COLORS.orange, roughness: 0.7, strokeWidth: 1.5,
  }))
  addText(svg, 270, 100, 'rAF callback', { size: 10, color: COLORS.orange, anchor: 'middle', weight: 600 })
  addText(svg, 270, 116, 'next vsync', { size: 8, color: COLORS.muted, anchor: 'middle' })

  // Render box
  svg.appendChild(rc.rectangle(400, 80, 120, 50, {
    fill: COLORS.green + '10', fillStyle: 'solid',
    stroke: COLORS.green, roughness: 0.7, strokeWidth: 1.5,
  }))
  addText(svg, 460, 100, 'render(now)', { size: 10, color: COLORS.green, anchor: 'middle', weight: 600 })
  addText(svg, 460, 116, 'step + paint', { size: 8, color: COLORS.muted, anchor: 'middle' })

  // Arrow: schedule → rAF
  svg.appendChild(rc.line(144, 105, 196, 105, {
    stroke: COLORS.fg, roughness: 0.5, strokeWidth: 1.2,
  }))
  addArrowhead(svg, 196, 105, 0, COLORS.fg)

  // Arrow: rAF → render
  svg.appendChild(rc.line(344, 105, 396, 105, {
    stroke: COLORS.fg, roughness: 0.5, strokeWidth: 1.2,
  }))
  addArrowhead(svg, 396, 105, 0, COLORS.fg)

  // Loop-back arrow: render → schedule (below the boxes)
  svg.appendChild(rc.line(460, 134, 460, 180, {
    stroke: COLORS.accent, roughness: 0.5, strokeWidth: 1.2,
  }))
  svg.appendChild(rc.line(460, 180, 85, 180, {
    stroke: COLORS.accent, roughness: 0.5, strokeWidth: 1.2,
  }))
  svg.appendChild(rc.line(85, 180, 85, 134, {
    stroke: COLORS.accent, roughness: 0.5, strokeWidth: 1.2,
  }))
  addArrowhead(svg, 85, 134, -Math.PI / 2, COLORS.accent)

  // Label on loop-back
  addText(svg, 270, 174, 'stillAnimating? schedule again', { size: 9, color: COLORS.accent, anchor: 'middle', weight: 600 })

  // Stop condition (branch off to the right)
  svg.appendChild(rc.line(520, 105, 570, 105, {
    stroke: COLORS.red, roughness: 0.5, strokeWidth: 1.2, strokeLineDash: [4, 4],
  }))
  svg.appendChild(rc.rectangle(540, 86, 60, 38, {
    fill: COLORS.red + '08', fillStyle: 'solid',
    stroke: COLORS.red, roughness: 0.6, strokeWidth: 1,
  }))
  addText(svg, 570, 110, 'STOP', { size: 10, color: COLORS.red, anchor: 'middle', weight: 700 })

  // Input trigger (top, pointing down to schedule)
  svg.appendChild(rc.line(85, 30, 85, 76, {
    stroke: COLORS.purple, roughness: 0.5, strokeWidth: 1.2,
  }))
  addArrowhead(svg, 85, 76, Math.PI / 2, COLORS.purple)
  addText(svg, 85, 22, 'input event / state change', { size: 9, color: COLORS.purple, anchor: 'middle' })

  // Timing note
  addText(svg, 310, 228, 'One rAF pending at a time — no duplicate scheduling', {
    size: 9, color: COLORS.muted, anchor: 'middle',
  })
}
