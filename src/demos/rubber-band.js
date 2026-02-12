// Rubber Band / Over-scroll Demo (Chapter 3)
// List is fixed — no scrolling. Drag down (or up) past the edge
// to feel rubber band resistance, release to spring back.

import { spring, springStep, springSnap, springAtRest, clamp, rubber, createPointerBuffer, pushPointer, clearPointer, getVelocity } from '../engine/render-loop.js'
import { onCleanup, onResize } from '../engine/lifecycle.js'
import { demoRGB } from '../engine/colors.js'

const ITEM_HEIGHT = 44
const ITEM_COUNT = 5
const MS_PER_STEP = 4
const DEFAULT_RANGE = 120

export function initRubberBand() {
  const demo = document.getElementById('demo-rubber')
  if (!demo) return

  // Hide pre-defined HTML elements
  const oldShell = demo.querySelector('.lp-shell')
  if (oldShell) oldShell.style.display = 'none'

  const readout = document.getElementById('rb-readout')
  const hint = document.getElementById('hint-rubber')
  const rangeSlider = document.getElementById('sl-rb-range')
  const rangeValue = document.getElementById('vl-rb-range')

  // === Create list container ===
  const listContainer = document.createElement('div')
  listContainer.style.cssText = `
    position: absolute;
    left: 50%;
    top: 24px;
    transform: translateX(-50%);
    width: min(320px, calc(100% - 48px));
    height: ${ITEM_COUNT * ITEM_HEIGHT}px;
    background: var(--bg, #fff);
    border-radius: 8px;
    border: 1px solid var(--border, rgba(0,0,0,0.1));
    overflow: hidden;
    cursor: grab;
    transition: border-color 0.15s;
  `
  demo.appendChild(listContainer)

  const listContent = document.createElement('div')
  listContent.style.cssText = `
    position: absolute;
    top: 0; left: 0; right: 0;
    will-change: transform;
  `
  listContainer.appendChild(listContent)

  for (let i = 0; i < ITEM_COUNT; i++) {
    const item = document.createElement('div')
    item.style.cssText = `
      height: ${ITEM_HEIGHT}px;
      display: flex;
      align-items: center;
      padding: 0 16px;
      border-bottom: 1px solid var(--border, rgba(0,0,0,0.06));
      font: 14px -apple-system, BlinkMacSystemFont, sans-serif;
      background: ${i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)'};
    `
    item.innerHTML = `
      <span style="font-weight:600;min-width:24px;color:var(--fg,#000)">${i + 1}</span>
      <span style="color:var(--fg-secondary,#666)">Item ${i + 1}</span>
    `
    listContent.appendChild(item)
  }

  // === State ===
  // rawOffset: how far content is pulled from rest (0 = resting)
  // negative = pulled down (overscroll top), positive = pulled up (overscroll bottom)
  let rawOffset = 0

  // Spring for bounce-back
  const sp = spring(0, 0, 290, 24)
  let animatedUntilTime = null

  /** @type {'up' | 'dragging'} */
  let pointerState = 'up'
  let lastY = 0

  function getRange() {
    return rangeSlider ? parseFloat(rangeSlider.value) : DEFAULT_RANGE
  }

  // === Events ===
  const events = {
    pointerdown: null,
    pointermove: null,
    pointerup: null,
  }

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

  function mapRubber(raw) {
    const range = getRange()
    if (raw === 0) return 0
    const sign = raw < 0 ? -1 : 1
    return sign * rubber(Math.abs(raw), range)
  }

  function updateBorderColor(raw) {
    const overAmount = Math.abs(raw)
    if (overAmount > 0) {
      const t = clamp(overAmount / 200, 0, 1)
      const r = Math.round(138 + t * 93)
      const g = Math.round(138 - t * 62)
      const b = Math.round(148 - t * 88)
      listContainer.style.borderColor = `rgb(${r},${g},${b})`
      listContainer.style.boxShadow = `inset 0 2px 8px rgba(0,0,0,0.06), 0 0 ${Math.round(t * 12)}px rgba(${demoRGB('red')}, ${t * 0.3})`
    } else {
      listContainer.style.borderColor = ''
      listContainer.style.boxShadow = ''
    }
  }

  // === Main Render ===
  function render(now) {
    let stillAnimating = false
    let displayOffset

    // pointerdown
    if (events.pointerdown) {
      pointerState = 'dragging'
      lastY = events.pointerdown.clientY
      // Capture current spring position
      rawOffset = sp.pos
      sp.v = 0
      animatedUntilTime = null
      listContainer.style.cursor = 'grabbing'
      if (hint) hint.style.display = 'none'
    }

    // pointermove — accumulate raw drag offset
    if (events.pointermove && pointerState === 'dragging') {
      const dy = events.pointermove.clientY - lastY
      lastY = events.pointermove.clientY
      rawOffset += dy  // positive = pulled down
    }

    // pointerup — spring back to 0
    if (events.pointerup && pointerState === 'dragging') {
      pointerState = 'up'
      listContainer.style.cursor = 'grab'
      sp.pos = mapRubber(rawOffset)
      sp.dest = 0
      sp.v = -sp.pos * 3  // initial kick toward rest
      animatedUntilTime = null
    }

    // === Physics ===
    if (pointerState === 'dragging') {
      displayOffset = mapRubber(rawOffset)
      updateBorderColor(rawOffset)
    } else {
      let newTime = animatedUntilTime ?? now
      const steps = Math.floor((now - newTime) / MS_PER_STEP)
      newTime += steps * MS_PER_STEP

      for (let i = 0; i < steps; i++) springStep(sp)
      if (springAtRest(sp)) {
        springSnap(sp)
      } else {
        stillAnimating = true
      }

      displayOffset = sp.pos
      rawOffset = sp.pos
      updateBorderColor(rawOffset)
      animatedUntilTime = stillAnimating ? newTime : null
    }

    // === DOM write ===
    // displayOffset > 0 means content pulled down, so translate positive
    listContent.style.transform = `translate3d(0, ${displayOffset}px, 0)`

    // Readout
    const overAmount = Math.abs(rawOffset)
    if (overAmount > 1 && (pointerState === 'dragging' || stillAnimating)) {
      const range = getRange()
      const ratio = (0.55 * range * range) / Math.pow(range + 0.55 * overAmount, 2)
      if (pointerState === 'dragging') {
        readout.innerHTML =
          `overscroll = <span class="val">${Math.round(overAmount)}px</span> ` +
          `ratio = <span class="val">${ratio.toFixed(2)}</span>`
      } else {
        readout.innerHTML =
          `state = <span class="val">bouncing back</span>`
      }
    } else {
      readout.innerHTML = ''
    }

    // Clear events
    events.pointerdown = null
    events.pointermove = null
    events.pointerup = null

    return stillAnimating || pointerState === 'dragging'
  }

  // === Event listeners ===
  let activePointerId = null

  listContainer.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    activePointerId = e.pointerId
    listContainer.setPointerCapture(e.pointerId)
    events.pointerdown = e
    scheduleRender()
  }, { passive: false })

  listContainer.addEventListener('pointermove', (e) => {
    if (e.pointerId !== activePointerId) return
    events.pointermove = e
    scheduleRender()
  })

  function handlePointerEnd(e) {
    if (pointerState !== 'dragging') return
    activePointerId = null
    events.pointerup = e
    scheduleRender()
  }

  listContainer.addEventListener('pointerup', handlePointerEnd)
  listContainer.addEventListener('pointercancel', handlePointerEnd)
  listContainer.addEventListener('lostpointercapture', handlePointerEnd)

  // Backup: catch pointerup on document in case capture was lost silently
  const onDocumentPointerUp = (e) => {
    if (pointerState === 'dragging') handlePointerEnd(e)
  }
  document.addEventListener('pointerup', onDocumentPointerUp)
  onCleanup(() => document.removeEventListener('pointerup', onDocumentPointerUp))

  // Elasticity slider
  if (rangeSlider) {
    rangeSlider.addEventListener('input', () => {
      if (rangeValue) rangeValue.textContent = rangeSlider.value
      scheduleRender()
    })
  }

  // Initial render
  scheduleRender()
  onResize(() => scheduleRender())
}

// Auto-init
if (document.getElementById('demo-rubber')) {
  initRubberBand()
}
