// Rough.js diagram renderer
// Creates hand-drawn style diagrams for gesture illustrations

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
  // Remove existing SVG if re-initializing (ViewTransitions)
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

// ─── TAP RECOGNITION DIAGRAM ───
export function drawTapTimeline(containerId) {
  const container = document.getElementById(containerId)
  if (!container) return

  const W = 520, H = 120
  const svg = createSvg(container, W, H, 'Tap recognition: finger down plus finger up, with duration under 300ms and movement under 10px, equals a tap')
  const rc = rough.svg(svg)

  // Down circle
  svg.appendChild(rc.circle(50, 45, 28, {
    fill: COLORS.red + '20', fillStyle: 'solid', stroke: COLORS.red, roughness: 0.7, strokeWidth: 1.5,
  }))
  addText(svg, 50, 49, 'DOWN', { size: 8, color: COLORS.red, anchor: 'middle', weight: 700 })

  // "+" label
  addText(svg, 90, 49, '+', { size: 14, color: COLORS.muted, anchor: 'middle' })

  // Up circle
  svg.appendChild(rc.circle(130, 45, 28, {
    fill: COLORS.green + '20', fillStyle: 'solid', stroke: COLORS.green, roughness: 0.7, strokeWidth: 1.5,
  }))
  addText(svg, 130, 49, 'UP', { size: 8, color: COLORS.green, anchor: 'middle', weight: 700 })

  // Arrow to conditions
  svg.appendChild(rc.line(148, 45, 185, 45, {
    stroke: COLORS.muted, roughness: 0.4, strokeWidth: 1.2,
  }))
  const a1 = document.createElementNS('http://www.w3.org/2000/svg', 'polygon')
  a1.setAttribute('points', '183,40 193,45 183,50')
  a1.setAttribute('fill', COLORS.muted)
  svg.appendChild(a1)

  // Condition box: time
  svg.appendChild(rc.rectangle(195, 18, 110, 24, {
    fill: COLORS.orange + '10', fillStyle: 'solid',
    stroke: COLORS.orange, roughness: 0.6, strokeWidth: 1.2,
  }))
  addText(svg, 250, 34, 'dt < 300ms', { size: 9, color: COLORS.orange, anchor: 'middle', weight: 600 })

  // Condition box: distance
  svg.appendChild(rc.rectangle(195, 52, 110, 24, {
    fill: COLORS.orange + '10', fillStyle: 'solid',
    stroke: COLORS.orange, roughness: 0.6, strokeWidth: 1.2,
  }))
  addText(svg, 250, 68, 'dist < 10px', { size: 9, color: COLORS.orange, anchor: 'middle', weight: 600 })

  // Arrows from conditions to result
  svg.appendChild(rc.line(308, 30, 355, 42, {
    stroke: COLORS.muted, roughness: 0.4, strokeWidth: 1,
  }))
  svg.appendChild(rc.line(308, 64, 355, 52, {
    stroke: COLORS.muted, roughness: 0.4, strokeWidth: 1,
  }))
  const a2 = document.createElementNS('http://www.w3.org/2000/svg', 'polygon')
  a2.setAttribute('points', '353,42 363,47 353,52')
  a2.setAttribute('fill', COLORS.muted)
  svg.appendChild(a2)

  // Result box
  svg.appendChild(rc.rectangle(365, 28, 100, 36, {
    fill: COLORS.accent + '10', fillStyle: 'solid',
    stroke: COLORS.accent, roughness: 0.6, strokeWidth: 1.5,
  }))
  addText(svg, 415, 51, '= TAP', { size: 14, color: COLORS.accent, anchor: 'middle', weight: 700 })

  // Bottom note
  addText(svg, 260, 105, 'Defined by what doesn\u2019t happen: no long hold, no significant movement', {
    size: 8, color: COLORS.muted, anchor: 'middle',
  })
}

// ─── GESTURE PIPELINE FLOW ───
export function drawPipelineFlow(containerId) {
  const container = document.getElementById(containerId)
  if (!container) return

  const W = 620, H = 100
  const svg = createSvg(container, W, H, 'Gesture pipeline: Input, Recognition, Dynamics, System — four stages connected by arrows')
  const rc = rough.svg(svg)

  const boxes = [
    { x: 20, label: 'INPUT', color: COLORS.red },
    { x: 170, label: 'RECOGNITION', color: COLORS.orange },
    { x: 340, label: 'DYNAMICS', color: COLORS.blue },
    { x: 490, label: 'SYSTEM', color: COLORS.green },
  ]

  boxes.forEach((b, i) => {
    const w = i === 1 ? 140 : 120
    svg.appendChild(rc.rectangle(b.x, 25, w, 44, {
      fill: b.color + '10', fillStyle: 'solid',
      stroke: b.color, roughness: 0.7, strokeWidth: 1.5,
    }))
    addText(svg, b.x + w / 2, 52, b.label, {
      size: 11, color: b.color, anchor: 'middle', weight: 700,
    })

    // Arrow between boxes
    if (i < boxes.length - 1) {
      const nextX = boxes[i + 1].x
      const endX = b.x + w
      const midY = 47
      svg.appendChild(rc.line(endX + 4, midY, nextX - 4, midY, {
        stroke: COLORS.muted, roughness: 0.5, strokeWidth: 1.2,
      }))
      const ax = nextX - 4
      const arrowHead = document.createElementNS('http://www.w3.org/2000/svg', 'polygon')
      arrowHead.setAttribute('points', `${ax - 8},${midY - 4} ${ax},${midY} ${ax - 8},${midY + 4}`)
      arrowHead.setAttribute('fill', COLORS.muted)
      svg.appendChild(arrowHead)
    }
  })

  // Subtitle labels
  addText(svg, 80, 86, 'pointer events', { size: 8, color: COLORS.muted, anchor: 'middle' })
  addText(svg, 240, 86, 'tap, drag, fling', { size: 8, color: COLORS.muted, anchor: 'middle' })
  addText(svg, 400, 86, 'spring, decay', { size: 8, color: COLORS.muted, anchor: 'middle' })
  addText(svg, 550, 86, 'scroll, a11y', { size: 8, color: COLORS.muted, anchor: 'middle' })
}

// ─── LONG PRESS DIAGRAM ───
export function drawLongPressTimeline(containerId) {
  const container = document.getElementById(containerId)
  if (!container) return

  const W = 520, H = 120
  const svg = createSvg(container, W, H, 'Long press: finger down plus hold for 400ms without moving equals long press')
  const rc = rough.svg(svg)

  // DOWN circle
  svg.appendChild(rc.circle(50, 45, 28, {
    fill: COLORS.red + '20', fillStyle: 'solid', stroke: COLORS.red, roughness: 0.7, strokeWidth: 1.5,
  }))
  addText(svg, 50, 49, 'DOWN', { size: 8, color: COLORS.red, anchor: 'middle', weight: 700 })

  // "+" label
  addText(svg, 90, 49, '+', { size: 14, color: COLORS.muted, anchor: 'middle' })

  // HOLD circle
  svg.appendChild(rc.circle(130, 45, 28, {
    fill: COLORS.purple + '20', fillStyle: 'solid', stroke: COLORS.purple, roughness: 0.7, strokeWidth: 1.5,
  }))
  addText(svg, 130, 49, 'HOLD', { size: 8, color: COLORS.purple, anchor: 'middle', weight: 700 })

  // Arrow to conditions
  svg.appendChild(rc.line(148, 45, 185, 45, {
    stroke: COLORS.muted, roughness: 0.4, strokeWidth: 1.2,
  }))
  const a1 = document.createElementNS('http://www.w3.org/2000/svg', 'polygon')
  a1.setAttribute('points', '183,40 193,45 183,50')
  a1.setAttribute('fill', COLORS.muted)
  svg.appendChild(a1)

  // Condition box: time
  svg.appendChild(rc.rectangle(195, 18, 110, 24, {
    fill: COLORS.orange + '10', fillStyle: 'solid',
    stroke: COLORS.orange, roughness: 0.6, strokeWidth: 1.2,
  }))
  addText(svg, 250, 34, 'dt > 400ms', { size: 9, color: COLORS.orange, anchor: 'middle', weight: 600 })

  // Condition box: distance
  svg.appendChild(rc.rectangle(195, 52, 110, 24, {
    fill: COLORS.orange + '10', fillStyle: 'solid',
    stroke: COLORS.orange, roughness: 0.6, strokeWidth: 1.2,
  }))
  addText(svg, 250, 68, 'dist < 10px', { size: 9, color: COLORS.orange, anchor: 'middle', weight: 600 })

  // Arrows from conditions to result
  svg.appendChild(rc.line(308, 30, 355, 42, {
    stroke: COLORS.muted, roughness: 0.4, strokeWidth: 1,
  }))
  svg.appendChild(rc.line(308, 64, 355, 52, {
    stroke: COLORS.muted, roughness: 0.4, strokeWidth: 1,
  }))
  const a2 = document.createElementNS('http://www.w3.org/2000/svg', 'polygon')
  a2.setAttribute('points', '353,42 363,47 353,52')
  a2.setAttribute('fill', COLORS.muted)
  svg.appendChild(a2)

  // Result box
  svg.appendChild(rc.rectangle(365, 28, 130, 36, {
    fill: COLORS.purple + '10', fillStyle: 'solid',
    stroke: COLORS.purple, roughness: 0.6, strokeWidth: 1.5,
  }))
  addText(svg, 430, 51, '= LONG PRESS', { size: 12, color: COLORS.purple, anchor: 'middle', weight: 700 })

  // Bottom note
  addText(svg, 260, 105, 'Timer fires while finger is still down', {
    size: 8, color: COLORS.muted, anchor: 'middle',
  })
}

// ─── DOUBLE TAP DIAGRAM ───
export function drawDoubleTapTimeline(containerId) {
  const container = document.getElementById(containerId)
  if (!container) return

  const W = 520, H = 120
  const svg = createSvg(container, W, H, 'Double tap: tap one plus tap two, within 300ms and 25px apart, equals double tap')
  const rc = rough.svg(svg)

  // TAP 1 circle
  svg.appendChild(rc.circle(50, 45, 28, {
    fill: COLORS.green + '20', fillStyle: 'solid', stroke: COLORS.green, roughness: 0.7, strokeWidth: 1.5,
  }))
  addText(svg, 50, 49, 'TAP 1', { size: 8, color: COLORS.green, anchor: 'middle', weight: 700 })

  // "+" label
  addText(svg, 90, 49, '+', { size: 14, color: COLORS.muted, anchor: 'middle' })

  // TAP 2 circle
  svg.appendChild(rc.circle(130, 45, 28, {
    fill: COLORS.purple + '20', fillStyle: 'solid', stroke: COLORS.purple, roughness: 0.7, strokeWidth: 1.5,
  }))
  addText(svg, 130, 49, 'TAP 2', { size: 8, color: COLORS.purple, anchor: 'middle', weight: 700 })

  // Arrow to conditions
  svg.appendChild(rc.line(148, 45, 185, 45, {
    stroke: COLORS.muted, roughness: 0.4, strokeWidth: 1.2,
  }))
  const a1 = document.createElementNS('http://www.w3.org/2000/svg', 'polygon')
  a1.setAttribute('points', '183,40 193,45 183,50')
  a1.setAttribute('fill', COLORS.muted)
  svg.appendChild(a1)

  // Condition box: time
  svg.appendChild(rc.rectangle(195, 18, 110, 24, {
    fill: COLORS.orange + '10', fillStyle: 'solid',
    stroke: COLORS.orange, roughness: 0.6, strokeWidth: 1.2,
  }))
  addText(svg, 250, 34, 'dt < 300ms', { size: 9, color: COLORS.orange, anchor: 'middle', weight: 600 })

  // Condition box: distance
  svg.appendChild(rc.rectangle(195, 52, 110, 24, {
    fill: COLORS.orange + '10', fillStyle: 'solid',
    stroke: COLORS.orange, roughness: 0.6, strokeWidth: 1.2,
  }))
  addText(svg, 250, 68, 'dist < 25px', { size: 9, color: COLORS.orange, anchor: 'middle', weight: 600 })

  // Arrows from conditions to result
  svg.appendChild(rc.line(308, 30, 355, 42, {
    stroke: COLORS.muted, roughness: 0.4, strokeWidth: 1,
  }))
  svg.appendChild(rc.line(308, 64, 355, 52, {
    stroke: COLORS.muted, roughness: 0.4, strokeWidth: 1,
  }))
  const a2 = document.createElementNS('http://www.w3.org/2000/svg', 'polygon')
  a2.setAttribute('points', '353,42 363,47 353,52')
  a2.setAttribute('fill', COLORS.muted)
  svg.appendChild(a2)

  // Result box
  svg.appendChild(rc.rectangle(365, 28, 130, 36, {
    fill: COLORS.accent + '10', fillStyle: 'solid',
    stroke: COLORS.accent, roughness: 0.6, strokeWidth: 1.5,
  }))
  addText(svg, 430, 51, '= DOUBLE TAP', { size: 12, color: COLORS.accent, anchor: 'middle', weight: 700 })

  // Bottom note
  addText(svg, 260, 105, 'Two quick taps in the same spot', {
    size: 8, color: COLORS.muted, anchor: 'middle',
  })
}

// ─── STATE MACHINE: ARBITRATION ───
// Simplified: PRESSED state with three competing exits
export function drawArbitrationDiagram(containerId) {
  const container = document.getElementById(containerId)
  if (!container) return

  const W = 520, H = 180
  const svg = createSvg(container, W, H, 'Gesture arbitration: PRESSED state with three competing exits — TAP, DRAG, or LONG PRESS')
  const rc = rough.svg(svg)

  // PRESSED box (center left)
  svg.appendChild(rc.rectangle(30, 65, 100, 50, {
    fill: COLORS.orange + '15', fillStyle: 'solid',
    stroke: COLORS.orange, roughness: 0.7, strokeWidth: 1.5,
  }))
  addText(svg, 80, 95, 'PRESSED', { size: 12, color: COLORS.orange, anchor: 'middle', weight: 700 })

  // "?" bubble
  svg.appendChild(rc.circle(80, 50, 20, {
    fill: '#fff', fillStyle: 'solid',
    stroke: COLORS.orange, roughness: 0.8, strokeWidth: 1,
  }))
  addText(svg, 80, 54, '?', { size: 12, color: COLORS.orange, anchor: 'middle', weight: 700 })

  // Three exit conditions with results
  const exits = [
    { y: 30, condition: 'up quickly', result: 'TAP', color: COLORS.green },
    { y: 90, condition: 'move > 10px', result: 'DRAG', color: COLORS.blue },
    { y: 150, condition: 'hold > 400ms', result: 'LONG PRESS', color: COLORS.purple },
  ]

  exits.forEach(({ y, condition, result, color }) => {
    // Arrow from PRESSED
    svg.appendChild(rc.line(134, 90, 180, y, {
      stroke: color, roughness: 0.5, strokeWidth: 1.2,
    }))
    const ah = document.createElementNS('http://www.w3.org/2000/svg', 'polygon')
    ah.setAttribute('points', `${180 - 6},${y - 4} ${180 + 2},${y} ${180 - 6},${y + 4}`)
    ah.setAttribute('fill', color)
    svg.appendChild(ah)

    // Condition box
    svg.appendChild(rc.rectangle(185, y - 15, 110, 30, {
      fill: color + '10', fillStyle: 'solid',
      stroke: color, roughness: 0.6, strokeWidth: 1,
    }))
    addText(svg, 240, y + 4, condition, { size: 9, color, anchor: 'middle', weight: 600 })

    // Arrow to result
    svg.appendChild(rc.line(298, y, 340, y, {
      stroke: COLORS.muted, roughness: 0.4, strokeWidth: 1,
    }))
    const ah2 = document.createElementNS('http://www.w3.org/2000/svg', 'polygon')
    ah2.setAttribute('points', `${340 - 6},${y - 4} ${340 + 2},${y} ${340 - 6},${y + 4}`)
    ah2.setAttribute('fill', COLORS.muted)
    svg.appendChild(ah2)

    // Result box
    const rw = result.length * 10 + 30
    svg.appendChild(rc.rectangle(345, y - 18, rw, 36, {
      fill: color + '10', fillStyle: 'solid',
      stroke: color, roughness: 0.6, strokeWidth: 1.5,
    }))
    addText(svg, 345 + rw / 2, y + 5, `= ${result}`, { size: 13, color, anchor: 'middle', weight: 700 })
  })

  // Note at bottom
  addText(svg, 260, 175, 'first condition to trigger wins', {
    size: 8, color: COLORS.muted, anchor: 'middle',
  })
}

// ─── POINTER EVENT MODEL DIAGRAM ───
// Four-phase feedback loop: Press → Follow → Release → Settle
export function drawPointerEventModel(containerId) {
  const container = document.getElementById(containerId)
  if (!container) return

  const W = 620, H = 130
  const svg = createSvg(container, W, H, 'The gesture feedback loop: four phases — Press, Follow, Release, Settle')
  const rc = rough.svg(svg)

  const phases = [
    { x: 20,  w: 110, label: 'PRESS',   sub: 'finger touches',   color: COLORS.red },
    { x: 160, w: 110, label: 'FOLLOW',  sub: '1:1 tracking',     color: COLORS.orange },
    { x: 300, w: 110, label: 'RELEASE', sub: 'finger lifts',     color: COLORS.green },
    { x: 440, w: 130, label: 'SETTLE',  sub: 'physics respond',  color: COLORS.blue },
  ]

  phases.forEach((p, i) => {
    // Box
    svg.appendChild(rc.rectangle(p.x, 25, p.w, 44, {
      fill: p.color + '12', fillStyle: 'solid',
      stroke: p.color, roughness: 0.7, strokeWidth: 1.5,
    }))
    // Label
    addText(svg, p.x + p.w / 2, 50, p.label, {
      size: 11, color: p.color, anchor: 'middle', weight: 700,
    })
    // Subtitle
    addText(svg, p.x + p.w / 2, 90, p.sub, {
      size: 9, color: COLORS.muted, anchor: 'middle',
    })

    // Arrow between boxes
    if (i < phases.length - 1) {
      const next = phases[i + 1]
      const startX = p.x + p.w + 4
      const endX = next.x - 4
      svg.appendChild(rc.line(startX, 47, endX, 47, {
        stroke: COLORS.muted, roughness: 0.5, strokeWidth: 1.2,
      }))
      const ah = document.createElementNS('http://www.w3.org/2000/svg', 'polygon')
      ah.setAttribute('points', `${endX - 8},${43} ${endX},${47} ${endX - 8},${51}`)
      ah.setAttribute('fill', COLORS.muted)
      svg.appendChild(ah)
    }
  })

  // Loop-back arrow from SETTLE back to PRESS
  const loopY = 112
  svg.appendChild(rc.line(505, 72, 505, loopY, {
    stroke: COLORS.muted, roughness: 0.4, strokeWidth: 0.8, strokeLineDash: [4, 3],
  }))
  svg.appendChild(rc.line(505, loopY, 75, loopY, {
    stroke: COLORS.muted, roughness: 0.4, strokeWidth: 0.8, strokeLineDash: [4, 3],
  }))
  svg.appendChild(rc.line(75, loopY, 75, 72, {
    stroke: COLORS.muted, roughness: 0.4, strokeWidth: 0.8, strokeLineDash: [4, 3],
  }))
  const loopArrow = document.createElementNS('http://www.w3.org/2000/svg', 'polygon')
  loopArrow.setAttribute('points', '70,76 75,68 80,76')
  loopArrow.setAttribute('fill', COLORS.muted)
  svg.appendChild(loopArrow)
}
