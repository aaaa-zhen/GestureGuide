// Rough.js diagrams for Chapter 2 — Continuous Gestures

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

function addArrowhead(svg, x, y, color, direction = 'right') {
  const ah = document.createElementNS('http://www.w3.org/2000/svg', 'polygon')
  if (direction === 'right') {
    ah.setAttribute('points', `${x - 8},${y - 4} ${x},${y} ${x - 8},${y + 4}`)
  } else if (direction === 'down') {
    ah.setAttribute('points', `${x - 4},${y - 8} ${x},${y} ${x + 4},${y - 8}`)
  }
  ah.setAttribute('fill', color)
  svg.appendChild(ah)
}

// ─── DRAG DIAGRAM ───
// Simple style: DOWN + MOVE = DRAG
export function drawDragDiagram(containerId) {
  const container = document.getElementById(containerId)
  if (!container) return

  const W = 520, H = 120
  const svg = createSvg(container, W, H, 'Drag: finger down plus move beyond 10px equals drag with 1:1 tracking')
  const rc = rough.svg(svg)

  // DOWN circle
  svg.appendChild(rc.circle(50, 45, 28, {
    fill: COLORS.red + '20', fillStyle: 'solid', stroke: COLORS.red, roughness: 0.7, strokeWidth: 1.5,
  }))
  addText(svg, 50, 49, 'DOWN', { size: 8, color: COLORS.red, anchor: 'middle', weight: 700 })

  // "+" label
  addText(svg, 90, 49, '+', { size: 14, color: COLORS.muted, anchor: 'middle' })

  // MOVE circle
  svg.appendChild(rc.circle(130, 45, 28, {
    fill: COLORS.blue + '20', fillStyle: 'solid', stroke: COLORS.blue, roughness: 0.7, strokeWidth: 1.5,
  }))
  addText(svg, 130, 49, 'MOVE', { size: 8, color: COLORS.blue, anchor: 'middle', weight: 700 })

  // Arrow to conditions
  svg.appendChild(rc.line(148, 45, 185, 45, {
    stroke: COLORS.muted, roughness: 0.4, strokeWidth: 1.2,
  }))
  const a1 = document.createElementNS('http://www.w3.org/2000/svg', 'polygon')
  a1.setAttribute('points', '183,40 193,45 183,50')
  a1.setAttribute('fill', COLORS.muted)
  svg.appendChild(a1)

  // Condition box: distance (touch slop)
  svg.appendChild(rc.rectangle(195, 30, 110, 30, {
    fill: COLORS.orange + '10', fillStyle: 'solid',
    stroke: COLORS.orange, roughness: 0.6, strokeWidth: 1.2,
  }))
  addText(svg, 250, 50, 'dist > 10px', { size: 9, color: COLORS.orange, anchor: 'middle', weight: 600 })

  // Arrow from condition to result
  svg.appendChild(rc.line(308, 45, 355, 45, {
    stroke: COLORS.muted, roughness: 0.4, strokeWidth: 1,
  }))
  const a2 = document.createElementNS('http://www.w3.org/2000/svg', 'polygon')
  a2.setAttribute('points', '353,40 363,45 353,50')
  a2.setAttribute('fill', COLORS.muted)
  svg.appendChild(a2)

  // Result box
  svg.appendChild(rc.rectangle(365, 28, 130, 36, {
    fill: COLORS.blue + '10', fillStyle: 'solid',
    stroke: COLORS.blue, roughness: 0.6, strokeWidth: 1.5,
  }))
  addText(svg, 430, 51, '= DRAG', { size: 14, color: COLORS.blue, anchor: 'middle', weight: 700 })

  // Bottom note
  addText(svg, 260, 105, '1:1 tracking — element follows finger exactly', {
    size: 8, color: COLORS.muted, anchor: 'middle',
  })
}

// ─── AXIS LOCK DIAGRAM ───
// Shows initial movement, then lock to X or Y axis
export function drawAxisLockDiagram(containerId) {
  const container = document.getElementById(containerId)
  if (!container) return

  const W = 620, H = 220
  const svg = createSvg(container, W, H, 'Axis lock diagram: initial diagonal movement, then the system locks to either X axis or Y axis based on dominant direction')
  const rc = rough.svg(svg)

  // Origin point (finger down)
  const ox = 160, oy = 110
  svg.appendChild(rc.circle(ox, oy, 20, {
    fill: COLORS.red, fillStyle: 'solid', stroke: COLORS.red, roughness: 0.8,
  }))
  addText(svg, ox, oy - 20, 'DOWN', { size: 10, color: COLORS.red, anchor: 'middle', weight: 600 })

  // Slop circle
  svg.appendChild(rc.circle(ox, oy, 60, {
    fill: 'none', stroke: COLORS.orange, roughness: 0.8, strokeWidth: 1.2,
    strokeLineDash: [4, 4],
  }))
  addText(svg, ox + 38, oy - 18, '10px', { size: 8, color: COLORS.orange })

  // X-axis lock path (dominant horizontal movement)
  svg.appendChild(rc.line(ox + 32, oy - 5, 460, oy - 5, {
    stroke: COLORS.blue, roughness: 0.6, strokeWidth: 2,
  }))
  addArrowhead(svg, 460, oy - 5, COLORS.blue, 'right')

  // X-lock label box
  svg.appendChild(rc.rectangle(470, oy - 24, 120, 36, {
    fill: COLORS.blue + '10', fillStyle: 'solid',
    stroke: COLORS.blue, roughness: 0.6, strokeWidth: 1.5,
  }))
  addText(svg, 530, oy - 1, 'LOCK X', { size: 13, color: COLORS.blue, anchor: 'middle', weight: 700 })

  // Y-axis lock path (dominant vertical movement)
  svg.appendChild(rc.line(ox + 5, oy + 32, ox + 5, 200, {
    stroke: COLORS.green, roughness: 0.6, strokeWidth: 2,
  }))
  addArrowhead(svg, ox + 5, 200, COLORS.green, 'down')

  // Y-lock label box
  svg.appendChild(rc.rectangle(ox + 30, 178, 120, 36, {
    fill: COLORS.green + '10', fillStyle: 'solid',
    stroke: COLORS.green, roughness: 0.6, strokeWidth: 1.5,
  }))
  addText(svg, ox + 90, 201, 'LOCK Y', { size: 13, color: COLORS.green, anchor: 'middle', weight: 700 })

  // Diagonal initial movement (what user actually does)
  svg.appendChild(rc.path(`M ${ox + 12} ${oy - 4} C ${ox + 30} ${oy - 15}, ${ox + 50} ${oy - 20}, ${ox + 70} ${oy - 12}`, {
    stroke: COLORS.muted, roughness: 0.8, strokeWidth: 1.2, fill: 'none',
    strokeLineDash: [3, 3],
  }))
  addText(svg, ox + 80, oy - 22, 'initial move', { size: 8, color: COLORS.muted })

  // Decision label
  addText(svg, 40, 30, 'dx > dy ?', { size: 11, color: COLORS.fg, weight: 600 })
  addText(svg, 40, 48, 'yes = lock X', { size: 9, color: COLORS.blue })
  addText(svg, 40, 62, 'no = lock Y', { size: 9, color: COLORS.green })
}

// ─── FLING DIAGRAM ───
// Simple style: DRAG + UP → velocity check → FLING or DRAG_END
export function drawFlingDiagram(containerId) {
  const container = document.getElementById(containerId)
  if (!container) return

  const W = 520, H = 120
  const svg = createSvg(container, W, H, 'Fling: drag ending with high velocity becomes a fling')
  const rc = rough.svg(svg)

  // DRAG circle
  svg.appendChild(rc.circle(50, 45, 28, {
    fill: COLORS.blue + '20', fillStyle: 'solid', stroke: COLORS.blue, roughness: 0.7, strokeWidth: 1.5,
  }))
  addText(svg, 50, 49, 'DRAG', { size: 8, color: COLORS.blue, anchor: 'middle', weight: 700 })

  // "+" label
  addText(svg, 90, 49, '+', { size: 14, color: COLORS.muted, anchor: 'middle' })

  // UP circle
  svg.appendChild(rc.circle(130, 45, 28, {
    fill: COLORS.green + '20', fillStyle: 'solid', stroke: COLORS.green, roughness: 0.7, strokeWidth: 1.5,
  }))
  addText(svg, 130, 49, 'UP', { size: 8, color: COLORS.green, anchor: 'middle', weight: 700 })

  // Arrow to condition
  svg.appendChild(rc.line(148, 45, 185, 45, {
    stroke: COLORS.muted, roughness: 0.4, strokeWidth: 1.2,
  }))
  const a1 = document.createElementNS('http://www.w3.org/2000/svg', 'polygon')
  a1.setAttribute('points', '183,40 193,45 183,50')
  a1.setAttribute('fill', COLORS.muted)
  svg.appendChild(a1)

  // Condition box: velocity threshold
  svg.appendChild(rc.rectangle(195, 30, 120, 30, {
    fill: COLORS.orange + '10', fillStyle: 'solid',
    stroke: COLORS.orange, roughness: 0.6, strokeWidth: 1.2,
  }))
  addText(svg, 255, 50, 'v > 950 px/s', { size: 9, color: COLORS.orange, anchor: 'middle', weight: 600 })

  // Arrow to result
  svg.appendChild(rc.line(318, 45, 365, 45, {
    stroke: COLORS.muted, roughness: 0.4, strokeWidth: 1,
  }))
  const a2 = document.createElementNS('http://www.w3.org/2000/svg', 'polygon')
  a2.setAttribute('points', '363,40 373,45 363,50')
  a2.setAttribute('fill', COLORS.muted)
  svg.appendChild(a2)

  // Result box
  svg.appendChild(rc.rectangle(375, 28, 120, 36, {
    fill: COLORS.red + '10', fillStyle: 'solid',
    stroke: COLORS.red, roughness: 0.6, strokeWidth: 1.5,
  }))
  addText(svg, 435, 51, '= FLING', { size: 14, color: COLORS.red, anchor: 'middle', weight: 700 })

  // Bottom note
  addText(svg, 260, 105, 'velocity measured from last ~100ms of movement', {
    size: 8, color: COLORS.muted, anchor: 'middle',
  })
}
