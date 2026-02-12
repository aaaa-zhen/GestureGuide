// Carousel / Page Turn Demo (Chapter 4)
// chenglou-style: swipeable page carousel with velocity-based snapping

import { spring, springStep, springSnap, springAtRest, clamp, createPointerBuffer, pushPointer, clearPointer, getVelocity } from '../engine/render-loop.js'
import { onResize } from '../engine/lifecycle.js'
import { demoRGBA } from '../engine/colors.js'

const MS_PER_STEP = 4
const PAGE_DEFS = [
  { label: 'Page 1', name: 'blue',   alphaFill: 0.12, alphaStroke: 0.5, alphaColor: 0.9 },
  { label: 'Page 2', name: 'green',  alphaFill: 0.12, alphaStroke: 0.5, alphaColor: 0.9 },
  { label: 'Page 3', name: 'orange', alphaFill: 0.12, alphaStroke: 0.5, alphaColor: 0.9 },
  { label: 'Page 4', name: 'purple', alphaFill: 0.12, alphaStroke: 0.5, alphaColor: 0.9 },
]
const PAGE_COUNT = PAGE_DEFS.length

function buildPages() {
  return PAGE_DEFS.map(d => ({
    label: d.label,
    fill: demoRGBA(d.name, d.alphaFill),
    stroke: demoRGBA(d.name, d.alphaStroke),
    color: demoRGBA(d.name, d.alphaColor),
  }))
}

export function initCarousel() {
  const demo = document.getElementById('demo-carousel')
  if (!demo) return

  const PAGES = buildPages()

  // Build DOM
  const viewport = document.createElement('div')
  viewport.style.cssText = `
    position:absolute; left:16px; right:16px; top:32px; bottom:48px;
    overflow:hidden; border-radius:8px; border:1px solid var(--border);
    cursor:grab;
  `

  const strip = document.createElement('div')
  strip.style.cssText = `
    display:flex; height:100%; will-change:transform;
  `

  PAGES.forEach((page) => {
    const pageEl = document.createElement('div')
    pageEl.style.cssText = `
      flex:0 0 100%; height:100%; display:grid; place-items:center;
      font-family:var(--font-mono); font-size:0.8rem; font-weight:600;
      color:${page.color}; background:${page.fill};
    `
    pageEl.textContent = page.label
    strip.appendChild(pageEl)
  })

  viewport.appendChild(strip)
  demo.appendChild(viewport)

  // Dots
  const dotsEl = document.createElement('div')
  dotsEl.style.cssText = `
    position:absolute; bottom:16px; left:0; right:0;
    display:flex; justify-content:center; gap:8px;
  `

  const dots = PAGES.map(() => {
    const dot = document.createElement('div')
    dot.style.cssText = `
      width:8px; height:8px; border-radius:50%;
      background:var(--border); transition:background 0.2s;
    `
    dotsEl.appendChild(dot)
    return dot
  })
  demo.appendChild(dotsEl)

  const readout = document.getElementById('carousel-readout')
  const hint = document.getElementById('hint-carousel')

  // === state ===
  const sx = spring(0, 0, 300, 28)
  let animatedUntilTime = null
  /** @type {'up' | 'dragging'} */
  let pointerState = 'up'
  let startX = 0
  let offsetAtStart = 0
  let currentPage = 0
  let pageWidth = 0
  const pointer = createPointerBuffer()

  // === events ===
  const events = {
    pointerdown: null,
    pointermove: null,
    pointerup: null,
    keydown: null,
  }

  // === scheduling ===
  let scheduledRender = false
  function scheduleRender() {
    if (scheduledRender) return
    scheduledRender = true
    requestAnimationFrame(function renderAndMaybeScheduleAnotherRender(now) {
      scheduledRender = false
      if (render(now)) scheduleRender()
    })
  }

  function getPageWidth() {
    pageWidth = viewport.clientWidth
  }

  function updateDots() {
    const progress = -sx.pos / (pageWidth || 1)
    const nearestPage = Math.round(clamp(progress, 0, PAGE_COUNT - 1))
    dots.forEach((dot, i) => {
      const dist = Math.abs(progress - i)
      dot.style.background = dist < 0.5 ? 'var(--accent)' : 'var(--border)'
    })
    // Update viewport border color to match current page
    viewport.style.borderColor = PAGES[nearestPage].stroke
  }

  function snapToPage(page) {
    currentPage = clamp(page, 0, PAGE_COUNT - 1)
    sx.dest = -currentPage * pageWidth
  }

  function goToPage(page, source = 'pointer') {
    animatedUntilTime = null
    snapToPage(page)
    readout.innerHTML = `${source} page = <span class="val">${currentPage + 1}</span>`
  }

  // === main render ===
  function render(now) {
    let stillAnimating = false

    // pointerdown
    if (events.pointerdown) {
      const e = events.pointerdown
      pointerState = 'dragging'
      startX = e.clientX
      offsetAtStart = sx.pos
      sx.v = 0
      animatedUntilTime = null
      hint.style.display = 'none'
      viewport.style.cursor = 'grabbing'

      clearPointer(pointer)
      pushPointer(pointer, e.clientX, e.clientY, e.timeStamp)
    }

    // pointermove
    if (events.pointermove && pointerState === 'dragging') {
      const e = events.pointermove
      pushPointer(pointer, e.clientX, e.clientY, e.timeStamp)

      const dx = e.clientX - startX
      let newPos = offsetAtStart + dx

      // Rubber band at edges
      const minPos = -(PAGE_COUNT - 1) * pageWidth
      if (newPos > 0) {
        newPos = newPos * 0.3
      } else if (newPos < minPos) {
        const over = minPos - newPos
        newPos = minPos - over * 0.3
      }

      sx.pos = sx.dest = newPos
    }

    // pointerup — if we didn't auto-snap during drag, decide based on velocity
    if (events.pointerup && pointerState === 'dragging') {
      pointerState = 'up'
      viewport.style.cursor = 'grab'

      const { vx } = getVelocity(pointer, performance.now())
      getPageWidth()
      animatedUntilTime = null

      // Fast flick: velocity alone can flip the page
      const FLICK_THRESHOLD = 300 // px/s
      if (Math.abs(vx) > FLICK_THRESHOLD) {
        const direction = vx > 0 ? -1 : 1
        goToPage(currentPage + direction)
      } else {
        // Slow release: snap to nearest page
        let targetPage = Math.round(-sx.pos / pageWidth)
        targetPage = clamp(targetPage, 0, PAGE_COUNT - 1)
        goToPage(targetPage)
      }

      readout.innerHTML = `page = <span class="val">${currentPage + 1}</span>\nvelocity = <span class="val">${Math.round(vx)}px/s</span>`
    }

    // keydown
    if (events.keydown) {
      const key = events.keydown.key
      hint.style.display = 'none'

      if (key === 'ArrowLeft') {
        goToPage(currentPage - 1, 'keyboard')
      } else if (key === 'ArrowRight') {
        goToPage(currentPage + 1, 'keyboard')
      } else if (key === 'Home') {
        goToPage(0, 'keyboard')
      } else if (key === 'End') {
        goToPage(PAGE_COUNT - 1, 'keyboard')
      }
    }

    // Physics
    if (pointerState !== 'dragging') {
      let newTime = animatedUntilTime ?? now
      const steps = Math.floor((now - newTime) / MS_PER_STEP)
      newTime += steps * MS_PER_STEP

      for (let i = 0; i < steps; i++) springStep(sx)
      if (springAtRest(sx)) springSnap(sx)
      else stillAnimating = true

      animatedUntilTime = stillAnimating ? newTime : null
    }

    // DOM write
    strip.style.transform = `translateX(${sx.pos}px)`
    updateDots()

    if (pointerState === 'dragging') {
      const approxPage = Math.round(-sx.pos / pageWidth)
      readout.innerHTML =
        `offset = <span class="val">${Math.round(sx.pos)}px</span>\n` +
        `page ~ <span class="val">${clamp(approxPage, 0, PAGE_COUNT - 1) + 1}</span>`
    }

    // Clear events
    events.pointerdown = null
    events.pointermove = null
    events.pointerup = null
    events.keydown = null

    return stillAnimating
  }

  // === event listeners ===
  viewport.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    viewport.setPointerCapture(e.pointerId)
    events.pointerdown = e
    scheduleRender()
  }, { passive: false })

  viewport.addEventListener('pointermove', (e) => {
    events.pointermove = e
    scheduleRender()
  })

  viewport.addEventListener('pointerup', (e) => {
    events.pointerup = e
    scheduleRender()
  })

  viewport.addEventListener('pointercancel', (e) => {
    events.pointerup = e
    scheduleRender()
  })

  demo.addEventListener('keydown', (e) => {
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
      e.preventDefault()
      events.keydown = e
      scheduleRender()
    }
  })

  // Initial layout
  function init() {
    getPageWidth()
    snapToPage(0)
    sx.pos = sx.dest
    sx.v = 0
    scheduleRender()
  }

  init()
  onResize(() => {
    getPageWidth()
    snapToPage(currentPage)
    sx.pos = sx.dest
    sx.v = 0
    animatedUntilTime = null
    scheduleRender()
  })
}

// Auto-init
if (document.getElementById('demo-carousel')) {
  initCarousel()
}
