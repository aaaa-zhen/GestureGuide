// Rough.js diagrams for Chapter 4: Gesture Patterns

import rough from 'roughjs'

const FONT = '"JetBrains Mono", "SF Mono", monospace'

function getColors() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
  return {
    red: isDark ? '#f07068' : '#e74c3c',
    green: isDark ? '#4cc98a' : '#27ae60',
    blue: isDark ? '#5a9cf5' : '#2b5ce6',
    purple: isDark ? '#a070d0' : '#7040b0',
    orange: isDark ? '#e8a030' : '#d4820a',
    fg: isDark ? '#d8d8e0' : '#1a1a1a',
    muted: isDark ? '#8888a0' : '#8a8a9a',
    border: isDark ? '#444460' : '#d0d0d0',
    accent: isDark ? '#5a9cf5' : '#2b5ce6',
    blueFill: isDark ? 'rgba(90, 156, 245, 0.12)' : 'rgba(43, 92, 230, 0.08)',
    redFill: isDark ? 'rgba(240, 112, 104, 0.12)' : 'rgba(231, 76, 60, 0.06)',
    boxFill: isDark ? 'rgba(90, 156, 245, 0.15)' : 'rgba(43, 92, 230, 0.08)',
    mutedFill: isDark ? 'rgba(136, 136, 160, 0.2)' : 'rgba(138, 138, 154, 0.19)',
  }
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
  el.setAttribute('fill', opts.color || getColors().fg)
  if (opts.anchor) el.setAttribute('text-anchor', opts.anchor)
  if (opts.weight) el.setAttribute('font-weight', opts.weight)
  el.textContent = text
  svg.appendChild(el)
  return el
}

function addArrowhead(svg, x, y, direction, color) {
  const ah = document.createElementNS('http://www.w3.org/2000/svg', 'polygon')
  if (direction === 'right') {
    ah.setAttribute('points', `${x - 8},${y - 4} ${x},${y} ${x - 8},${y + 4}`)
  } else if (direction === 'left') {
    ah.setAttribute('points', `${x + 8},${y - 4} ${x},${y} ${x + 8},${y + 4}`)
  } else if (direction === 'down') {
    ah.setAttribute('points', `${x - 4},${y - 8} ${x},${y} ${x + 4},${y - 8}`)
  }
  ah.setAttribute('fill', color)
  svg.appendChild(ah)
}

// ─── SWIPE TO DISMISS DIAGRAM ───
export function drawSwipeDiagram(containerId) {
  const container = document.getElementById(containerId)
  if (!container) return

  const C = getColors()
  const W = 620, H = 170
  const svg = createSvg(container, W, H, 'Swipe to dismiss: card dragged horizontally, velocity check, fly out or snap back')
  const rc = rough.svg(svg)

  // Container outline
  svg.appendChild(rc.rectangle(40, 30, 540, 100, {
    stroke: C.border, roughness: 0.5, strokeWidth: 1, fill: 'none',
  }))
  addText(svg, 310, 22, 'container', { size: 9, color: C.muted, anchor: 'middle' })

  // Card at rest (center)
  svg.appendChild(rc.rectangle(235, 55, 100, 50, {
    fill: C.blueFill, fillStyle: 'solid',
    stroke: C.blue, roughness: 0.7, strokeWidth: 1.5,
  }))
  addText(svg, 285, 85, 'card', { size: 10, color: C.blue, anchor: 'middle', weight: 600 })

  // Drag arrow (right)
  svg.appendChild(rc.line(340, 80, 460, 80, {
    stroke: C.orange, roughness: 0.6, strokeWidth: 1.5,
  }))
  addArrowhead(svg, 460, 80, 'right', C.orange)
  addText(svg, 400, 70, 'drag', { size: 9, color: C.orange, anchor: 'middle' })

  // Velocity vector
  svg.appendChild(rc.line(460, 80, 530, 80, {
    stroke: C.red, roughness: 0.4, strokeWidth: 2,
    strokeLineDash: [6, 3],
  }))
  addArrowhead(svg, 530, 80, 'right', C.red)
  addText(svg, 495, 70, 'vx', { size: 10, color: C.red, anchor: 'middle', weight: 600 })

  // Threshold line (40% mark)
  const threshX = 40 + 540 * 0.4
  svg.appendChild(rc.line(threshX, 30, threshX, 130, {
    stroke: C.purple, roughness: 0.4, strokeWidth: 1,
    strokeLineDash: [4, 4],
  }))
  addText(svg, threshX, 148, '40% threshold', { size: 9, color: C.purple, anchor: 'middle' })

  // Labels
  addText(svg, 120, 148, 'snap back', { size: 10, color: C.green, anchor: 'middle', weight: 600 })
  addText(svg, 495, 148, 'dismiss!', { size: 10, color: C.red, anchor: 'middle', weight: 600 })

  // Snap-back arrow (left side)
  svg.appendChild(rc.line(160, 80, 100, 80, {
    stroke: C.green, roughness: 0.6, strokeWidth: 1.2,
  }))
  addArrowhead(svg, 160, 80, 'left', C.green)
}

// ─── PULL TO REFRESH DIAGRAM ───
export function drawPullRefreshDiagram(containerId) {
  const container = document.getElementById(containerId)
  if (!container) return

  const C = getColors()
  const W = 620, H = 200
  const svg = createSvg(container, W, H, 'Pull to refresh: overscroll with rubber band resistance, threshold line, refresh indicator')
  const rc = rough.svg(svg)

  // Phone/container outline
  svg.appendChild(rc.rectangle(80, 20, 180, 160, {
    stroke: C.border, roughness: 0.6, strokeWidth: 1.2, fill: 'none',
  }))

  // List items (shifted down)
  for (let i = 0; i < 4; i++) {
    const y = 70 + i * 28
    svg.appendChild(rc.rectangle(90, y, 160, 22, {
      fill: i === 0 ? C.accent + '10' : C.mutedFill,
      fillStyle: 'solid',
      stroke: C.border, roughness: 0.5, strokeWidth: 0.8,
    }))
    addText(svg, 170, y + 15, `item ${i + 1}`, { size: 8, color: C.muted, anchor: 'middle' })
  }

  // Refresh indicator
  svg.appendChild(rc.circle(170, 50, 20, {
    fill: C.accent + '20', fillStyle: 'solid',
    stroke: C.accent, roughness: 0.8, strokeWidth: 1.5,
  }))
  addText(svg, 170, 54, '↻', { size: 12, color: C.accent, anchor: 'middle', weight: 700 })

  // Pull arrow
  svg.appendChild(rc.line(170, 10, 170, 35, {
    stroke: C.orange, roughness: 0.5, strokeWidth: 1.5,
  }))
  addArrowhead(svg, 170, 35, 'down', C.orange)
  addText(svg, 200, 22, 'pull', { size: 10, color: C.orange })

  // Threshold line
  svg.appendChild(rc.line(80, 65, 260, 65, {
    stroke: C.purple, roughness: 0.4, strokeWidth: 1,
    strokeLineDash: [4, 4],
  }))
  addText(svg, 275, 69, 'threshold', { size: 9, color: C.purple })

  // Right side: rubber band curve
  addText(svg, 420, 30, 'Rubber Band Mapping', { size: 11, color: C.fg, anchor: 'middle', weight: 600 })

  // Axes
  svg.appendChild(rc.line(340, 170, 540, 170, {
    stroke: C.muted, roughness: 0.3, strokeWidth: 1,
  }))
  svg.appendChild(rc.line(340, 170, 340, 50, {
    stroke: C.muted, roughness: 0.3, strokeWidth: 1,
  }))
  addText(svg, 440, 190, 'finger distance', { size: 8, color: C.muted, anchor: 'middle' })
  addText(svg, 325, 110, 'UI', { size: 8, color: C.muted, anchor: 'middle' })

  // Linear reference line (dashed)
  svg.appendChild(rc.line(340, 170, 540, 50, {
    stroke: C.border, roughness: 0.3, strokeWidth: 0.8,
    strokeLineDash: [4, 4],
  }))
  addText(svg, 550, 55, '1:1', { size: 8, color: C.border })

  // Rubber band curve (flattening)
  svg.appendChild(rc.path('M 340 170 C 380 130, 420 100, 460 85 S 510 72, 540 68', {
    stroke: C.accent, roughness: 0.5, strokeWidth: 2, fill: 'none',
  }))
  addText(svg, 550, 73, 'rubber', { size: 8, color: C.accent })
}

// ─── CAROUSEL DIAGRAM ───
export function drawCarouselDiagram(containerId) {
  const container = document.getElementById(containerId)
  if (!container) return

  const C = getColors()
  const W = 620, H = 150
  const svg = createSvg(container, W, H, 'Carousel: horizontal pages with snap points between them')
  const rc = rough.svg(svg)

  // Viewport outline
  svg.appendChild(rc.rectangle(180, 20, 260, 80, {
    stroke: C.fg, roughness: 0.6, strokeWidth: 1.5, fill: 'none',
  }))
  addText(svg, 310, 14, 'viewport', { size: 9, color: C.muted, anchor: 'middle' })

  // Pages (extended strip)
  const pages = [
    { x: 30, color: C.blue, label: 'P1' },
    { x: 190, color: C.green, label: 'P2' },
    { x: 350, color: C.orange, label: 'P3' },
    { x: 510, color: C.purple, label: 'P4' },
  ]

  pages.forEach(p => {
    const inView = p.x >= 170 && p.x <= 440
    svg.appendChild(rc.rectangle(p.x, 25, 130, 70, {
      fill: p.color + (inView ? '25' : '10'),
      fillStyle: 'solid',
      stroke: p.color,
      roughness: 0.6,
      strokeWidth: inView ? 1.5 : 0.8,
    }))
    addText(svg, p.x + 65, 66, p.label, {
      size: 12, color: p.color, anchor: 'middle', weight: 600,
    })
  })

  // Snap points
  const snaps = [190, 350, 510]
  snaps.forEach(x => {
    svg.appendChild(rc.line(x, 105, x, 120, {
      stroke: C.purple, roughness: 0.3, strokeWidth: 1.5,
    }))
    svg.appendChild(rc.circle(x, 124, 6, {
      fill: C.purple, fillStyle: 'solid',
      stroke: C.purple, roughness: 0.4,
    }))
  })

  addText(svg, 350, 145, 'snap points', { size: 9, color: C.purple, anchor: 'middle' })

  // Drag arrow
  svg.appendChild(rc.line(380, 60, 280, 60, {
    stroke: C.orange, roughness: 0.5, strokeWidth: 1.5,
  }))
  addArrowhead(svg, 280, 60, 'left', C.orange)

  // Dots
  const dotY = 110
  const dotStartX = 280
  for (let i = 0; i < 4; i++) {
    const dx = dotStartX + i * 20
    svg.appendChild(rc.circle(dx, dotY, 8, {
      fill: i === 1 ? C.accent : C.border,
      fillStyle: 'solid',
      stroke: i === 1 ? C.accent : C.border,
      roughness: 0.4,
    }))
  }
}

// ─── DRAGGABLE GRID DIAGRAM ───
export function drawReorderDiagram(containerId) {
  const container = document.getElementById(containerId)
  if (!container) return

  const C = getColors()
  const W = 620, H = 200
  const svg = createSvg(container, W, H, 'Draggable grid: drag a tile to swap positions, displaced tile springs into the vacated cell')
  const rc = rough.svg(svg)

  const S = 48   // cell size
  const G = 6    // gap

  // === Left: resting grid ===
  const lx = 60, ly = 30
  addText(svg, lx + (S * 3 + G * 2) / 2, ly - 8, 'At Rest', { size: 11, color: C.fg, anchor: 'middle', weight: 600 })

  const labels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']
  const colors = [C.blue, C.green, C.orange, C.purple, C.red, C.accent, C.purple, C.muted, C.blue]

  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const idx = r * 3 + c
      const x = lx + c * (S + G)
      const y = ly + r * (S + G)
      const col = colors[idx]
      svg.appendChild(rc.rectangle(x, y, S, S, {
        fill: col + '15', fillStyle: 'solid',
        stroke: col + '60', roughness: 0.6,
        strokeWidth: idx === 1 ? 1.5 : 0.8,
      }))
      addText(svg, x + S / 2, y + S / 2 + 4, labels[idx], {
        size: 11, color: col, anchor: 'middle', weight: 600,
      })
    }
  }

  // Arrow between states
  const arrowX1 = lx + 3 * (S + G) + 16
  const arrowX2 = arrowX1 + 50
  const arrowY = ly + (S * 3 + G * 2) / 2
  svg.appendChild(rc.line(arrowX1, arrowY, arrowX2, arrowY, {
    stroke: C.muted, roughness: 0.5, strokeWidth: 1.2,
  }))
  addArrowhead(svg, arrowX2, arrowY, 'right', C.muted)

  // === Right: dragging state ===
  const rx = 340, ry = 30
  addText(svg, rx + (S * 3 + G * 2) / 2, ry - 8, 'Dragging B', { size: 11, color: C.fg, anchor: 'middle', weight: 600 })

  // After dragging: B is heading toward E's slot, E springs to B's old slot
  // Grid order after swap: A, E, C, D, B, F, G, H, I
  const dragLabels = ['A', 'E', 'C', 'D', 'B', 'F', 'G', 'H', 'I']
  const dragColors = [C.blue, C.red, C.orange, C.purple, C.green, C.accent, C.purple, C.muted, C.blue]
  const draggedIdx = 4  // B is at grid index 4

  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const idx = r * 3 + c
      if (idx === draggedIdx) continue  // draw dragged last
      const x = rx + c * (S + G)
      const y = ry + r * (S + G)
      const col = dragColors[idx]
      svg.appendChild(rc.rectangle(x, y, S, S, {
        fill: col + '15', fillStyle: 'solid',
        stroke: col + '60', roughness: 0.6, strokeWidth: 0.8,
      }))
      addText(svg, x + S / 2, y + S / 2 + 4, dragLabels[idx], {
        size: 11, color: col, anchor: 'middle', weight: 600,
      })
    }
  }

  // E moving from (1,1) to (0,1): curved arrow
  const eFromX = rx + 1 * (S + G) + S / 2
  const eFromY = ry + 1 * (S + G) + S / 2
  const eToX = rx + 1 * (S + G) + S / 2
  const eToY = ry + 0 * (S + G) + S / 2
  svg.appendChild(rc.path(`M ${eFromX + S / 2 + 4} ${eFromY} C ${eFromX + S / 2 + 20} ${eFromY - 15}, ${eToX + S / 2 + 20} ${eToY + 15}, ${eToX + S / 2 + 4} ${eToY}`, {
    stroke: C.green, roughness: 0.5, strokeWidth: 1.2, fill: 'none',
  }))
  addArrowhead(svg, eToX + S / 2 + 4, eToY, 'left', C.green)
  addText(svg, eFromX + S / 2 + 26, (eFromY + eToY) / 2 + 3, 'swap', { size: 8, color: C.green })

  // Dragged tile B (elevated, slightly offset from center)
  const bx = rx + 1 * (S + G) - 4
  const by = ry + 1 * (S + G) + 6
  svg.appendChild(rc.rectangle(bx, by, S + 4, S + 4, {
    fill: C.green + '20', fillStyle: 'solid',
    stroke: C.green, roughness: 0.7, strokeWidth: 2,
  }))
  addText(svg, bx + (S + 4) / 2, by + (S + 4) / 2 + 4, 'B', {
    size: 13, color: C.green, anchor: 'middle', weight: 700,
  })

  // Shadow under dragged tile
  svg.appendChild(rc.line(bx + 3, by + S + 6, bx + S + 1, by + S + 6, {
    stroke: C.muted + '40', roughness: 0.3, strokeWidth: 3,
  }))

  // Pointer icon near dragged tile
  svg.appendChild(rc.circle(bx + S / 2 + 2, by - 6, 8, {
    fill: C.orange + '30', fillStyle: 'solid',
    stroke: C.orange, roughness: 0.5, strokeWidth: 1,
  }))

  // Bottom label
  addText(svg, rx + (S * 3 + G * 2) / 2, ry + 3 * (S + G) + 14, 'nearest cell → swap', {
    size: 9, color: C.purple, anchor: 'middle',
  })
}
