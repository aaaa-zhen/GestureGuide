// Draggable Grid Demo (Chapter 3)
// Chenglou-style: 3×3 grid, direct drag to swap, x/y/scale springs, release velocity

import { spring, springStep, springSnap, springAtRest } from '../engine/render-loop.js'
import { onResize } from '../engine/lifecycle.js'
import { demoRGBA } from '../engine/colors.js'

const MS_PER_STEP = 4
const COLS = 3
const ROWS = 3
const COUNT = COLS * ROWS
const GAP = 6

const LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']

function buildFills() {
  return [
    { fill: demoRGBA('blue', 0.10),   stroke: demoRGBA('blue', 0.35),   color: demoRGBA('blue', 0.85) },
    { fill: demoRGBA('green', 0.10),   stroke: demoRGBA('green', 0.35),   color: demoRGBA('green', 0.85) },
    { fill: demoRGBA('orange', 0.10),  stroke: demoRGBA('orange', 0.35),  color: demoRGBA('orange', 0.85) },
    { fill: demoRGBA('purple', 0.10),  stroke: demoRGBA('purple', 0.35),  color: demoRGBA('purple', 0.85) },
    { fill: demoRGBA('red', 0.10),     stroke: demoRGBA('red', 0.35),     color: demoRGBA('red', 0.85) },
    { fill: 'rgba(20, 150, 150, 0.10)',  stroke: 'rgba(20, 150, 150, 0.35)',  color: 'rgba(20, 150, 150, 0.85)' },
    { fill: 'rgba(180, 80, 140, 0.10)',  stroke: 'rgba(180, 80, 140, 0.35)',  color: 'rgba(180, 80, 140, 0.85)' },
    { fill: 'rgba(100, 100, 100, 0.10)', stroke: 'rgba(100, 100, 100, 0.35)', color: 'rgba(100, 100, 100, 0.85)' },
    { fill: 'rgba(50, 120, 200, 0.10)',  stroke: 'rgba(50, 120, 200, 0.35)',  color: 'rgba(50, 120, 200, 0.85)' },
  ]
}

export function initReorderList() {
  const demo = document.getElementById('demo-reorder')
  if (!demo) return

  const FILLS = buildFills()

  const readout = document.getElementById('reorder-readout')
  const hint = document.getElementById('hint-reorder')

  // === Compute grid geometry ===
  let cellW = 0
  let cellH = 0
  let gridLeft = 0
  let gridTop = 0

  function computeGrid() {
    const demoW = demo.clientWidth
    const demoH = demo.clientHeight
    const usableW = demoW - 32  // 16px padding each side
    const usableH = demoH - 32
    const maxCellW = Math.floor((usableW - GAP * (COLS - 1)) / COLS)
    const maxCellH = Math.floor((usableH - GAP * (ROWS - 1)) / ROWS)
    const cellSize = Math.min(maxCellW, maxCellH)
    cellW = cellSize
    cellH = cellSize
    const totalW = cellW * COLS + GAP * (COLS - 1)
    const totalH = cellH * ROWS + GAP * (ROWS - 1)
    gridLeft = Math.floor((demoW - totalW) / 2)
    gridTop = Math.floor((demoH - totalH) / 2)
  }

  function gridPos(index) {
    const col = index % COLS
    const row = Math.floor(index / COLS)
    return {
      x: gridLeft + col * (cellW + GAP),
      y: gridTop + row * (cellH + GAP),
    }
  }

  // === Build DOM ===
  const items = []
  for (let i = 0; i < COUNT; i++) {
    const el = document.createElement('div')
    const f = FILLS[i]
    el.style.cssText = `
      position:absolute; display:grid; place-items:center; overflow:hidden;
      border-radius:8px; cursor:grab;
      font-family:var(--font-mono); font-size:0.8rem; font-weight:700;
      color:${f.color}; background:${f.fill}; border:1px solid ${f.stroke};
      will-change:transform;
      transition:box-shadow 0.25s ease-out, opacity 0.25s ease-out;
      user-select:none; -webkit-user-select:none;
    `
    el.textContent = LABELS[i]
    demo.appendChild(el)

    items.push({
      id: i,
      label: LABELS[i],
      gridIndex: i,  // current position in grid (0..8)
      x: spring(0),
      y: spring(0),
      scale: spring(1),
      el,
    })
  }

  // order[gridIndex] = item — which item is at each grid position
  let order = items.slice()

  // === state ===
  let animatedUntilTime = null
  let dragged = null  // { itemId, deltaX, deltaY }
  let lastDraggedId = null
  /** @type {'up' | 'down' | 'firstDown'} */
  let pointerState = 'up'
  let pointer = [{ x: 0, y: 0, time: 0 }]

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
    requestAnimationFrame(function renderFrame(now) {
      scheduledRender = false
      if (render(now)) scheduleRender()
    })
  }

  function hitTest(px, py) {
    // Test against actual spring positions (visual positions)
    for (let i = order.length - 1; i >= 0; i--) {
      const item = order[i]
      if (item.x.pos <= px && px < item.x.pos + cellW &&
          item.y.pos <= py && py < item.y.pos + cellH) {
        return item
      }
    }
    return null
  }

  function nearestGridIndex(px, py) {
    // Find which grid cell center is closest to (px, py)
    let best = 0
    let bestDist = Infinity
    for (let gi = 0; gi < COUNT; gi++) {
      const pos = gridPos(gi)
      const cx = pos.x + cellW / 2
      const cy = pos.y + cellH / 2
      const dist = (px - cx) ** 2 + (py - cy) ** 2
      if (dist < bestDist) {
        bestDist = dist
        best = gi
      }
    }
    return best
  }

  // === main render ===
  function render(now) {
    // === step 0: process events ===
    if (events.pointerup) pointerState = 'up'

    if (events.pointermove) {
      const rect = demo.getBoundingClientRect()
      pointer.push({
        x: events.pointermove.clientX - rect.left,
        y: events.pointermove.clientY - rect.top,
        time: performance.now(),
      })
    }

    if (events.pointerdown) {
      pointerState = 'firstDown'
      const rect = demo.getBoundingClientRect()
      pointer.push({
        x: events.pointerdown.clientX - rect.left,
        y: events.pointerdown.clientY - rect.top,
        time: performance.now(),
      })
      if (hint) hint.style.display = 'none'
    }

    // === step 1: DOM reads ===
    const pointerLast = pointer[pointer.length - 1]

    // === step 2: input state change ===
    let newDragged
    if (pointerState === 'down') {
      newDragged = dragged
    } else if (pointerState === 'up') {
      if (dragged != null) {
        // Apply release velocity
        const item = items[dragged.itemId]
        let i = pointer.length - 1
        while (i >= 0 && now - pointer[i].time <= 100) i--
        if (i < 0) i = 0
        const deltaTime = now - pointer[i].time
        if (deltaTime > 0) {
          const vx = (pointerLast.x - pointer[i].x) / deltaTime * 1000
          const vy = (pointerLast.y - pointer[i].y) / deltaTime * 1000
          item.x.v += vx
          item.y.v += vy
        }
      }
      newDragged = null
    } else {
      // firstDown — hit test
      const hit = hitTest(pointerLast.x, pointerLast.y)
      if (hit) {
        newDragged = {
          itemId: hit.id,
          deltaX: pointerLast.x - hit.x.pos,
          deltaY: pointerLast.y - hit.y.pos,
        }
      } else {
        newDragged = null
      }
    }

    // === step 3: layout ===
    if (newDragged) {
      const item = items[newDragged.itemId]

      // Position dragged item at pointer
      item.x.pos = item.x.dest = pointerLast.x - newDragged.deltaX
      item.y.pos = item.y.dest = pointerLast.y - newDragged.deltaY
      item.scale.dest = 1.08

      // Find which grid cell the pointer is closest to
      const targetGI = nearestGridIndex(
        pointerLast.x,
        pointerLast.y,
      )
      const currentGI = item.gridIndex

      // Swap if dragged over a different cell
      if (targetGI !== currentGI) {
        const otherItem = order[targetGI]
        // Swap grid positions
        order[currentGI] = otherItem
        order[targetGI] = item
        otherItem.gridIndex = currentGI
        item.gridIndex = targetGI
      }
    }

    // Set destinations for all non-dragged items
    for (let gi = 0; gi < COUNT; gi++) {
      const item = order[gi]
      if (newDragged && item.id === newDragged.itemId) continue
      const pos = gridPos(gi)
      item.x.dest = pos.x
      item.y.dest = pos.y
      item.scale.dest = 1
    }

    // Cursor
    const cursor = newDragged ? 'grabbing'
      : hitTest(pointerLast.x, pointerLast.y) ? 'grab'
      : ''

    // === step 4: physics ===
    let newAnimatedUntilTime = animatedUntilTime ?? now
    const steps = Math.floor((now - newAnimatedUntilTime) / MS_PER_STEP)
    newAnimatedUntilTime += steps * MS_PER_STEP
    let stillAnimating = false

    for (const item of items) {
      for (const s of [item.x, item.y, item.scale]) {
        for (let i = 0; i < steps; i++) springStep(s)
        if (Math.abs(s.v) < 0.01 && Math.abs(s.dest - s.pos) < 0.01) springSnap(s)
        else stillAnimating = true
      }
    }

    // === step 5: DOM writes ===
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const style = item.el.style
      style.width = `${cellW}px`
      style.height = `${cellH}px`
      style.transform = `translate3d(${item.x.pos}px,${item.y.pos}px,0) scale(${item.scale.pos})`

      if (newDragged && item.id === newDragged.itemId) {
        style.zIndex = String(COUNT + 2)
        style.boxShadow = 'rgba(0,0,0,0.15) 0px 16px 32px 0px'
        style.opacity = '0.85'
        style.cursor = 'grabbing'
      } else if (lastDraggedId != null && item.id === lastDraggedId) {
        style.zIndex = String(COUNT + 1)
        style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'
        style.opacity = '1'
        style.cursor = 'grab'
      } else {
        style.zIndex = String(i)
        style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'
        style.opacity = '1'
        style.cursor = 'grab'
      }
    }

    if (cursor) demo.style.cursor = cursor
    else demo.style.cursor = ''

    // Readout
    if (newDragged) {
      const item = items[newDragged.itemId]
      const pos = gridPos(item.gridIndex)
      const col = item.gridIndex % COLS
      const row = Math.floor(item.gridIndex / COLS)
      readout.innerHTML = `dragging = <span class="val">${item.label}</span> → cell <span class="val">(${col},${row})</span>`
    } else if (dragged && !newDragged) {
      readout.innerHTML = `grid = <span class="val">[${order.map(it => it.label).join(', ')}]</span>`
    }

    // === step 6: update state ===
    if (pointerState === 'firstDown') pointerState = 'down'
    if (dragged && newDragged == null) lastDraggedId = dragged.itemId
    dragged = newDragged
    animatedUntilTime = stillAnimating ? newAnimatedUntilTime : null
    if (pointerState === 'up') pointer = [{ x: 0, y: 0, time: 0 }]
    if (pointer.length > 20) pointer.shift()

    events.pointerdown = null
    events.pointermove = null
    events.pointerup = null

    return stillAnimating
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

  // Initial layout
  function layout() {
    computeGrid()
    for (let gi = 0; gi < COUNT; gi++) {
      const item = order[gi]
      const pos = gridPos(gi)
      item.x.pos = item.x.dest = pos.x
      item.y.pos = item.y.dest = pos.y
      item.scale.pos = item.scale.dest = 1
      item.x.v = item.y.v = item.scale.v = 0
    }
    scheduleRender()
  }

  layout()
  onResize(layout)
}

// Auto-init
if (document.getElementById('demo-reorder')) {
  initReorderList()
}
