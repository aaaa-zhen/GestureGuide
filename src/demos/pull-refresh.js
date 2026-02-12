// Pull to Refresh Demo (Chapter 4)
// chenglou-style: pull down gesture with rubber band effect

import { spring, springStep, springSnap, springAtRest, rubber } from '../engine/render-loop.js'

const MS_PER_STEP = 4
const THRESHOLD = 60
const RUBBER_RANGE = 160
const LIST_ITEMS = ['Email from Alice', 'Meeting at 3pm', 'Build review', 'Ship v2.1', 'Design sync', 'Coffee chat']

export function initPullRefresh() {
  const demo = document.getElementById('demo-pull-refresh')
  if (!demo) return

  const readout = document.getElementById('ptr-readout')
  const hint = document.getElementById('hint-ptr')

  // Build DOM
  const container = document.createElement('div')
  container.style.cssText = `
    position:absolute; left:16px; right:16px; top:36px; bottom:16px;
    border:1px solid var(--border); border-radius:8px;
    overflow:hidden; background:var(--bg);
  `

  const indicator = document.createElement('div')
  indicator.style.cssText = `
    position:absolute; top:0; left:0; right:0;
    height:40px; display:grid; place-items:center;
    font-family:var(--font-mono); font-size:0.62rem; font-weight:600;
    color:var(--accent); opacity:0; transform:translateY(-40px);
    transition:opacity 0.15s;
  `
  indicator.textContent = 'Pull to refresh'

  const listEl = document.createElement('div')
  listEl.style.cssText = `
    position:absolute; left:0; right:0; top:0; bottom:0;
    will-change:transform;
  `

  LIST_ITEMS.forEach((text) => {
    const item = document.createElement('div')
    item.style.cssText = `
      padding:12px 16px; border-bottom:1px solid var(--border);
      font-family:var(--font-mono); font-size:0.7rem;
      color:var(--fg-secondary); background:var(--bg);
    `
    item.textContent = text
    listEl.appendChild(item)
  })

  container.appendChild(indicator)
  container.appendChild(listEl)
  demo.appendChild(container)

  // === state ===
  const sy = spring(0, 0, 320, 28)
  let animatedUntilTime = null
  /** @type {'up' | 'dragging'} */
  let pointerState = 'up'
  let startY = 0
  let keyboardPull = 0
  let isRefreshing = false

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

  function startRefresh(source = 'pointer') {
    if (isRefreshing) return
    isRefreshing = true
    sy.dest = 50
    animatedUntilTime = null
    readout.innerHTML = `${source} state = <span class="val">refreshing</span>`

    setTimeout(() => {
      isRefreshing = false
      keyboardPull = 0
      sy.dest = 0
      animatedUntilTime = null
      readout.innerHTML = 'state = <span class="val">done</span>'
      scheduleRender()
    }, 1000)
  }

  function cancelPull(source = 'pointer') {
    keyboardPull = 0
    sy.dest = 0
    animatedUntilTime = null
    readout.innerHTML = `${source} state = <span class="val">cancelled</span>`
  }

  // === main render ===
  function render(now) {
    let stillAnimating = false

    // pointerdown
    if (events.pointerdown && !isRefreshing) {
      const e = events.pointerdown
      pointerState = 'dragging'
      startY = e.clientY
      keyboardPull = 0
      sy.v = 0
      animatedUntilTime = null
      if (hint) hint.style.display = 'none'
    }

    // pointermove
    if (events.pointermove && pointerState === 'dragging' && !isRefreshing) {
      const e = events.pointermove
      const dy = e.clientY - startY

      if (dy > 0) {
        keyboardPull = dy
        const rubberY = rubber(dy, RUBBER_RANGE)
        sy.pos = sy.dest = rubberY
      }
    }

    // pointerup
    if (events.pointerup && pointerState === 'dragging' && !isRefreshing) {
      pointerState = 'up'
      animatedUntilTime = null

      if (sy.pos > THRESHOLD) {
        startRefresh()
      } else {
        cancelPull()
      }
    }

    // keydown
    if (events.keydown && !isRefreshing) {
      const key = events.keydown.key
      if (hint) hint.style.display = 'none'

      if (key === 'ArrowDown') {
        keyboardPull = Math.min(RUBBER_RANGE, keyboardPull + 14)
        const rubberY = rubber(keyboardPull, RUBBER_RANGE)
        sy.pos = sy.dest = rubberY
      } else if (key === 'ArrowUp') {
        keyboardPull = 0
        sy.pos = sy.dest = 0
      } else if (key === 'Enter' || key === ' ') {
        if (sy.pos <= THRESHOLD) {
          keyboardPull = THRESHOLD + 12
          const rubberY = rubber(keyboardPull, RUBBER_RANGE)
          sy.pos = sy.dest = rubberY
        }
        startRefresh('keyboard')
      } else if (key === 'Escape') {
        cancelPull('keyboard')
      }
    }

    // Physics
    if (pointerState !== 'dragging') {
      let newTime = animatedUntilTime ?? now
      const steps = Math.floor((now - newTime) / MS_PER_STEP)
      newTime += steps * MS_PER_STEP

      for (let i = 0; i < steps; i++) springStep(sy)
      if (springAtRest(sy)) springSnap(sy)
      else stillAnimating = true

      animatedUntilTime = stillAnimating ? newTime : null
    }

    // DOM write
    listEl.style.transform = `translateY(${sy.pos}px)`
    indicator.style.transform = `translateY(${sy.pos - 40}px)`
    indicator.style.opacity = Math.min(1, sy.pos / THRESHOLD)

    if (isRefreshing) {
      indicator.textContent = 'Refreshing...'
    } else if (sy.pos > THRESHOLD) {
      indicator.textContent = 'Release to refresh'
    } else {
      indicator.textContent = 'Pull to refresh'
    }

    if (pointerState === 'dragging' && !isRefreshing) {
      readout.innerHTML =
        `pull = <span class="val">${Math.round(keyboardPull)}px</span>\n` +
        `rubber = <span class="val">${Math.round(sy.pos)}px</span>\n` +
        `threshold = <span class="val">${sy.pos > THRESHOLD ? 'passed' : Math.round(sy.pos / THRESHOLD * 100) + '%'}</span>`
    }

    // Clear events
    events.pointerdown = null
    events.pointermove = null
    events.pointerup = null
    events.keydown = null

    return stillAnimating
  }

  // === event listeners ===
  container.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    container.setPointerCapture(e.pointerId)
    events.pointerdown = e
    scheduleRender()
  }, { passive: false })

  container.addEventListener('pointermove', (e) => {
    events.pointermove = e
    scheduleRender()
  })

  container.addEventListener('pointerup', (e) => {
    events.pointerup = e
    scheduleRender()
  })

  container.addEventListener('pointercancel', (e) => {
    events.pointerup = e
    scheduleRender()
  })

  demo.addEventListener('keydown', (e) => {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' ', 'Escape'].includes(e.key)) {
      e.preventDefault()
      events.keydown = e
      scheduleRender()
    }
  })
}

// Auto-init
if (document.getElementById('demo-pull-refresh')) {
  initPullRefresh()
}
