// Rough.js diagram renderer for Chapter 3: Dynamics
// Hand-drawn style diagrams for momentum, spring, snap, rubber band

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
    // Semi-transparent fills for boxes
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

// ─── MOMENTUM DIAGRAM: interactive velocity decay curve ───
export function drawMomentumDiagram(containerId) {
  const container = document.getElementById(containerId)
  if (!container) return

  const W = 520, H = 160
  const svg = createSvg(container, W, H, 'Momentum decay diagram: velocity decreases exponentially over time due to friction')
  const rc = rough.svg(svg)

  // State
  let friction = 0.985

  // Create slider controls
  let controlsEl = container.querySelector('.diagram-controls')
  if (!controlsEl) {
    controlsEl = document.createElement('div')
    controlsEl.className = 'diagram-controls'
    controlsEl.style.cssText = 'display:flex;gap:12px;align-items:center;margin-top:8px;font-size:12px;color:var(--fg-muted, #8a8a9a);'
    controlsEl.innerHTML = `
      <label style="display:flex;align-items:center;gap:6px;">
        friction
        <input type="range" id="dia-mom-friction" min="0.95" max="0.998" step="0.002" value="0.985" style="width:120px;">
        <span id="dia-mom-friction-val" style="font-family:monospace;min-width:45px;">0.985</span>
      </label>
    `
    container.appendChild(controlsEl)
  }

  const slider = controlsEl.querySelector('#dia-mom-friction')
  const valSpan = controlsEl.querySelector('#dia-mom-friction-val')

  function draw() {
    const C = getColors()

    // Clear and recreate SVG content
    while (svg.firstChild) svg.removeChild(svg.firstChild)

    // Axes
    svg.appendChild(rc.line(50, 20, 50, 130, {
      stroke: C.border, roughness: 0.5, strokeWidth: 1.2,
    }))
    svg.appendChild(rc.line(50, 130, 480, 130, {
      stroke: C.border, roughness: 0.5, strokeWidth: 1.2,
    }))

    // Axis labels
    addText(svg, 25, 75, 'v', { size: 12, color: C.fg, anchor: 'middle', weight: 600 })
    addText(svg, 490, 134, 't', { size: 12, color: C.muted })

    // Release point
    svg.appendChild(rc.circle(70, 35, 10, {
      fill: C.red, fillStyle: 'solid', stroke: C.red, roughness: 0.8,
    }))
    addText(svg, 70, 22, 'release', { size: 8, color: C.red, anchor: 'middle' })

    // Decay curve
    let pathD = 'M 70 35'
    const v0 = 95
    for (let t = 0; t <= 100; t++) {
      const x = 70 + t * 4
      const v = v0 * Math.pow(friction, t * 2)
      const y = 130 - v
      pathD += ` L ${x} ${y}`
    }

    svg.appendChild(rc.path(pathD, {
      stroke: C.blue, roughness: 0.6, strokeWidth: 2.5, fill: 'none',
    }))

    // Find where v ≈ 0 (v < 1)
    let stopT = 0
    for (let t = 0; t <= 100; t++) {
      if (v0 * Math.pow(friction, t * 2) < 1) {
        stopT = t
        break
      }
    }
    const stopX = Math.min(70 + stopT * 4, 470)

    // Stop marker
    if (stopT > 0 && stopT < 100) {
      svg.appendChild(rc.line(stopX, 125, stopX, 135, {
        stroke: C.green, roughness: 0.4, strokeWidth: 1.5,
      }))
      addText(svg, stopX, 148, 'stop', { size: 8, color: C.green, anchor: 'middle' })
    }

    // Formula box
    svg.appendChild(rc.rectangle(320, 30, 150, 28, {
      fill: C.blueFill, fillStyle: 'solid',
      stroke: C.accent, roughness: 0.5, strokeWidth: 1,
    }))
    addText(svg, 395, 49, `v *= ${friction}`, { size: 11, color: C.accent, anchor: 'middle', weight: 600 })
  }

  // Initial draw
  draw()

  // Slider event
  slider.addEventListener('input', () => {
    friction = parseFloat(slider.value)
    valSpan.textContent = friction.toFixed(3)
    draw()
  })
}

// ─── SPRING DIAGRAM: mass-spring system with force vectors ───
export function drawSpringDiagram(containerId) {
  const container = document.getElementById(containerId)
  if (!container) return

  const C = getColors()
  const W = 620, H = 200
  const svg = createSvg(container, W, H, 'Spring physics diagram: mass connected to anchor by spring, with restoring force and damping arrows')
  const rc = rough.svg(svg)

  // Anchor wall
  svg.appendChild(rc.rectangle(50, 60, 16, 80, {
    fill: C.mutedFill, fillStyle: 'cross-hatch',
    stroke: C.muted, roughness: 0.7, hachureGap: 5,
  }))
  addText(svg, 58, 55, 'anchor', { size: 9, color: C.muted, anchor: 'middle' })

  // Spring coils (zig-zag line from anchor to mass)
  let springPath = 'M 66 100'
  const coilStart = 76
  const coilEnd = 270
  const coils = 8
  const segLen = (coilEnd - coilStart) / (coils * 2)
  for (let i = 0; i < coils * 2; i++) {
    const x = coilStart + (i + 1) * segLen
    const y = 100 + (i % 2 === 0 ? -16 : 16)
    springPath += ` L ${x} ${y}`
  }
  springPath += ` L ${coilEnd + 10} 100`

  svg.appendChild(rc.path(springPath, {
    stroke: C.fg, roughness: 0.6, strokeWidth: 1.5, fill: 'none',
  }))

  // Mass box
  svg.appendChild(rc.rectangle(280, 75, 50, 50, {
    fill: C.boxFill, fillStyle: 'solid',
    stroke: C.blue, roughness: 0.7, strokeWidth: 2,
  }))
  addText(svg, 305, 105, 'm', { size: 14, color: C.blue, anchor: 'middle', weight: 700 })

  // Displacement x arrow
  svg.appendChild(rc.line(58, 170, 305, 170, {
    stroke: C.orange, roughness: 0.4, strokeWidth: 1,
  }))
  const xArrow = document.createElementNS('http://www.w3.org/2000/svg', 'polygon')
  xArrow.setAttribute('points', '300,166 310,170 300,174')
  xArrow.setAttribute('fill', C.orange)
  svg.appendChild(xArrow)
  addText(svg, 180, 186, 'displacement x', { size: 10, color: C.orange, anchor: 'middle' })

  // Restoring force arrow (leftward, from mass)
  svg.appendChild(rc.line(280, 100, 370, 100, {
    stroke: C.red, roughness: 0.5, strokeWidth: 2,
  }))
  const fArrow = document.createElementNS('http://www.w3.org/2000/svg', 'polygon')
  fArrow.setAttribute('points', '278,95 268,100 278,105')
  fArrow.setAttribute('fill', C.red)
  svg.appendChild(fArrow)

  // Force label with box
  svg.appendChild(rc.rectangle(380, 65, 200, 40, {
    fill: C.redFill, fillStyle: 'solid',
    stroke: C.red, roughness: 0.5, strokeWidth: 1,
  }))
  addText(svg, 480, 90, 'F = -kx - bv', { size: 14, color: C.red, anchor: 'middle', weight: 700 })

  // Labels for k and b
  addText(svg, 400, 120, 'k = stiffness', { size: 9, color: C.muted })
  addText(svg, 400, 136, 'b = damping', { size: 9, color: C.muted })
  addText(svg, 400, 152, 'x = displacement', { size: 9, color: C.muted })
  addText(svg, 400, 168, 'v = velocity', { size: 9, color: C.muted })
}

// ─── SNAP DIAGRAM: decay-targeted critically damped spring ───
export function drawSnapDiagram(containerId) {
  const container = document.getElementById(containerId)
  if (!container) return

  const C = getColors()
  const W = 620, H = 260
  const svg = createSvg(container, W, H, 'Snap diagram: exponential decay predicts resting position, critically damped spring drives to nearest snap point')
  const rc = rough.svg(svg)

  const trackL = 60, trackR = 560
  const snaps = [0, 0.25, 0.5, 0.75, 1.0]
  function snapX(f) { return trackL + f * (trackR - trackL) }

  // === Scenario A: slow release → decay predicts nearby → nearest snap ===
  const yA = 60

  // Track
  svg.appendChild(rc.line(trackL, yA, trackR, yA, {
    stroke: C.border, roughness: 0.4, strokeWidth: 1.5,
  }))

  // Snap ticks
  for (const f of snaps) {
    const x = snapX(f)
    svg.appendChild(rc.line(x, yA - 8, x, yA + 8, {
      stroke: C.muted, roughness: 0.3, strokeWidth: 1.2,
    }))
  }

  // Release dot at ~35%
  const releaseX = snapX(0.35)
  svg.appendChild(rc.circle(releaseX, yA, 14, {
    fill: C.orange, fillStyle: 'solid', stroke: C.orange, roughness: 0.8,
  }))

  // Small velocity arrow (slow)
  svg.appendChild(rc.line(releaseX + 12, yA, releaseX + 25, yA, {
    stroke: C.orange, roughness: 0.5, strokeWidth: 2,
  }))
  const aSmall = document.createElementNS('http://www.w3.org/2000/svg', 'polygon')
  aSmall.setAttribute('points', `${releaseX + 22},${yA - 4} ${releaseX + 29},${yA} ${releaseX + 22},${yA + 4}`)
  aSmall.setAttribute('fill', C.orange)
  svg.appendChild(aSmall)

  // Decay predicted position (ghost) at ~40%
  const decayA = snapX(0.40)
  svg.appendChild(rc.circle(decayA, yA, 10, {
    fill: 'none', stroke: C.orange, roughness: 0.6, strokeWidth: 1,
    strokeLineDash: [3, 3],
  }))
  addText(svg, decayA, yA - 14, 'decay', { size: 7, color: C.orange, anchor: 'middle' })

  // Spring arrow to 50% snap (nearest to decay prediction)
  const targetA = snapX(0.5)
  svg.appendChild(rc.line(decayA + 8, yA + 14, targetA - 4, yA + 14, {
    stroke: C.blue, roughness: 0.5, strokeWidth: 1.5, strokeLineDash: [5, 4],
  }))
  const arrowA = document.createElementNS('http://www.w3.org/2000/svg', 'polygon')
  arrowA.setAttribute('points', `${targetA - 8},${yA + 10} ${targetA},${yA + 14} ${targetA - 8},${yA + 18}`)
  arrowA.setAttribute('fill', C.blue)
  svg.appendChild(arrowA)

  // Highlight target snap
  svg.appendChild(rc.circle(targetA, yA, 20, {
    fill: 'none', stroke: C.blue, roughness: 0.8, strokeWidth: 2,
  }))

  // Label
  addText(svg, trackR + 5, yA - 10, 'slow v →', { size: 9, color: C.orange })
  addText(svg, trackR + 5, yA + 4, 'snap 50%', { size: 9, color: C.blue, weight: 600 })

  // Scenario label
  addText(svg, 30, yA + 4, 'A', { size: 14, color: C.muted, anchor: 'middle', weight: 700 })

  // === Scenario B: fast release → decay predicts far → skips items ===
  const yB = 155

  // Track
  svg.appendChild(rc.line(trackL, yB, trackR, yB, {
    stroke: C.border, roughness: 0.4, strokeWidth: 1.5,
  }))

  // Snap ticks with labels
  for (const f of snaps) {
    const x = snapX(f)
    svg.appendChild(rc.line(x, yB - 8, x, yB + 8, {
      stroke: C.muted, roughness: 0.3, strokeWidth: 1.2,
    }))
    addText(svg, x, yB + 24, `${Math.round(f * 100)}%`, { size: 8, color: C.muted, anchor: 'middle' })
  }

  // Release dot at same ~35%
  svg.appendChild(rc.circle(releaseX, yB, 14, {
    fill: C.orange, fillStyle: 'solid', stroke: C.orange, roughness: 0.8,
  }))

  // Large velocity arrow (fast)
  svg.appendChild(rc.line(releaseX + 12, yB, releaseX + 60, yB, {
    stroke: C.orange, roughness: 0.5, strokeWidth: 2.5,
  }))
  const aLarge = document.createElementNS('http://www.w3.org/2000/svg', 'polygon')
  aLarge.setAttribute('points', `${releaseX + 55},${yB - 5} ${releaseX + 65},${yB} ${releaseX + 55},${yB + 5}`)
  aLarge.setAttribute('fill', C.orange)
  svg.appendChild(aLarge)

  // Decay predicted position (ghost) at ~80%
  const decayB = snapX(0.80)
  svg.appendChild(rc.circle(decayB, yB, 10, {
    fill: 'none', stroke: C.orange, roughness: 0.6, strokeWidth: 1,
    strokeLineDash: [3, 3],
  }))
  addText(svg, decayB, yB - 14, 'decay', { size: 7, color: C.orange, anchor: 'middle' })

  // Spring arrow to 75% (nearest snap to decay prediction)
  const targetB = snapX(0.75)
  svg.appendChild(rc.line(decayB - 8, yB + 14, targetB + 4, yB + 14, {
    stroke: C.green, roughness: 0.5, strokeWidth: 1.5, strokeLineDash: [5, 4],
  }))
  const arrowB = document.createElementNS('http://www.w3.org/2000/svg', 'polygon')
  arrowB.setAttribute('points', `${targetB + 8},${yB + 10} ${targetB},${yB + 14} ${targetB + 8},${yB + 18}`)
  arrowB.setAttribute('fill', C.green)
  svg.appendChild(arrowB)

  // Highlight target snap
  svg.appendChild(rc.circle(targetB, yB, 20, {
    fill: 'none', stroke: C.green, roughness: 0.8, strokeWidth: 2,
  }))

  // Label
  addText(svg, trackR + 5, yB - 10, 'fast v →', { size: 9, color: C.orange })
  addText(svg, trackR + 5, yB + 4, 'snap 75%', { size: 9, color: C.green, weight: 600 })

  // Scenario label
  addText(svg, 30, yB + 4, 'B', { size: 14, color: C.muted, anchor: 'middle', weight: 700 })

  // Formula annotation
  svg.appendChild(rc.rectangle(130, 205, 360, 32, {
    fill: C.blueFill, fillStyle: 'solid',
    stroke: C.accent, roughness: 0.5, strokeWidth: 1,
  }))
  addText(svg, 310, 225, 'target = snap( pos + v / (1 − decayRate) )', { size: 10, color: C.accent, anchor: 'middle', weight: 600 })

  // Spring label
  addText(svg, 310, 248, 'then critically damped spring (ζ = 1.0) drives to target', { size: 8, color: C.muted, anchor: 'middle' })
}

// ─── RUBBER BAND DIAGRAM: interactive resistance curve ───
export function drawRubberBandDiagram(containerId) {
  const container = document.getElementById(containerId)
  if (!container) return

  const W = 620, H = 200
  const svg = createSvg(container, W, H, 'Rubber band diagram: drag the slider to see how resistance coefficient changes the displacement curve')
  const RANGE = 150  // asymptotic max (in drawing units)

  // State
  let coeff = 0.55

  // Create slider controls (like momentum diagram)
  let controlsEl = container.querySelector('.diagram-controls')
  if (!controlsEl) {
    controlsEl = document.createElement('div')
    controlsEl.className = 'diagram-controls'
    controlsEl.style.cssText = 'display:flex;gap:12px;align-items:center;margin-top:8px;font-size:12px;color:var(--fg-muted, #8a8a9a);'
    controlsEl.innerHTML = `
      <label style="display:flex;align-items:center;gap:6px;">
        resistance c
        <input type="range" id="dia-rb-coeff" min="0.15" max="1.0" step="0.05" value="0.55" style="width:120px;">
        <span id="dia-rb-coeff-val" style="font-family:monospace;min-width:35px;">0.55</span>
      </label>
    `
    container.appendChild(controlsEl)
  }

  const slider = controlsEl.querySelector('#dia-rb-coeff')
  const valSpan = controlsEl.querySelector('#dia-rb-coeff-val')

  function rubberF(d, c) {
    return (d * c * RANGE) / (RANGE + c * d)
  }

  function draw() {
    const C = getColors()
    const rc = rough.svg(svg)

    // Clear SVG
    while (svg.firstChild) svg.removeChild(svg.firstChild)

    // Axes
    svg.appendChild(rc.line(80, 20, 80, 170, {
      stroke: C.border, roughness: 0.5, strokeWidth: 1.2,
    }))
    svg.appendChild(rc.line(80, 170, 560, 170, {
      stroke: C.border, roughness: 0.5, strokeWidth: 1.2,
    }))

    addText(svg, 30, 95, 'visual', { size: 9, color: C.muted, anchor: 'middle' })
    addText(svg, 30, 107, 'offset', { size: 9, color: C.muted, anchor: 'middle' })
    addText(svg, 320, 188, 'finger distance past boundary', { size: 9, color: C.muted, anchor: 'middle' })

    // Boundary marker
    svg.appendChild(rc.line(80, 170, 80, 165, {
      stroke: C.fg, roughness: 0.3, strokeWidth: 1.5,
    }))
    addText(svg, 80, 190, 'boundary', { size: 9, color: C.fg, anchor: 'middle' })

    // Linear 1:1 line (dashed)
    svg.appendChild(rc.line(80, 170, 500, 30, {
      stroke: C.muted, roughness: 0.5, strokeWidth: 1.5, strokeLineDash: [8, 5],
    }))
    addText(svg, 510, 30, '1:1 linear', { size: 9, color: C.muted })

    // Asymptote (max visual offset = RANGE)
    // In drawing coords: y = 170 - RANGE = 20
    svg.appendChild(rc.line(80, 20, 500, 20, {
      stroke: C.red + '60', roughness: 0.3, strokeWidth: 1, strokeLineDash: [4, 4],
    }))
    addText(svg, 510, 24, 'max', { size: 9, color: C.red })

    // Rubber band curve
    let rubberPath = 'M 80 170'
    for (let d = 0; d <= 420; d += 4) {
      const mapped = rubberF(d, coeff)
      rubberPath += ` L ${80 + d} ${170 - mapped}`
    }
    svg.appendChild(rc.path(rubberPath, {
      stroke: C.blue, roughness: 0.7, strokeWidth: 2.5, fill: 'none',
    }))
    addText(svg, 510, 170 - rubberF(420, coeff) - 4, 'rubber band', { size: 10, color: C.blue, weight: 600 })

    // Sample point at d=200: show ratio between rubber band and linear
    const sampleD = 200
    const sampleMapped = rubberF(sampleD, coeff)
    const sampleLinear = sampleD  // 1:1
    const sampleX = 80 + sampleD
    const sampleRubberY = 170 - sampleMapped
    const sampleLinearY = 170 - Math.min(sampleLinear, 150) // clamp to drawing area

    // Dot on curve
    svg.appendChild(rc.circle(sampleX, sampleRubberY, 10, {
      fill: C.blue, fillStyle: 'solid', stroke: C.blue, roughness: 0.8,
    }))

    // Vertical dashed line from rubber point up to linear point
    svg.appendChild(rc.line(sampleX, sampleRubberY, sampleX, sampleLinearY, {
      stroke: C.orange, roughness: 0.4, strokeWidth: 1.5, strokeLineDash: [4, 3],
    }))

    // Dot on linear line
    svg.appendChild(rc.circle(sampleX, sampleLinearY, 8, {
      fill: 'none', stroke: C.orange, roughness: 0.6, strokeWidth: 1.5, strokeLineDash: [3, 3],
    }))

    // Ratio label
    const ratio = (sampleMapped / sampleLinear).toFixed(2)
    svg.appendChild(rc.rectangle(sampleX + 8, (sampleRubberY + sampleLinearY) / 2 - 11, 52, 22, {
      fill: C.blueFill, fillStyle: 'solid',
      stroke: C.orange, roughness: 0.5, strokeWidth: 1,
    }))
    addText(svg, sampleX + 34, (sampleRubberY + sampleLinearY) / 2 + 4, `${ratio}×`, {
      size: 11, color: C.orange, anchor: 'middle', weight: 700,
    })

    // Formula box
    svg.appendChild(rc.rectangle(140, 100, 260, 28, {
      fill: C.blueFill, fillStyle: 'solid',
      stroke: C.accent, roughness: 0.5, strokeWidth: 1,
    }))
    addText(svg, 270, 118, `f(d) = (d × ${coeff.toFixed(2)} × R) / (R + ${coeff.toFixed(2)} × d)`, {
      size: 10, color: C.accent, anchor: 'middle', weight: 600,
    })
  }

  // Initial draw
  draw()

  // Slider event
  slider.addEventListener('input', () => {
    coeff = parseFloat(slider.value)
    valSpan.textContent = coeff.toFixed(2)
    draw()
  })
}
