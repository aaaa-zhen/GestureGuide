// Elastic Demo (Chapter 2)
// Side-by-side: left ball controlled by k/b sliders, right ball fixed reference (k=290 b=24)
// Click to trigger both — compare your spring vs the reference

import { spring, springStep, springSnap, springAtRest } from '../engine/render-loop.js'

const MS_PER_STEP = 4
const BALL_SIZE = 44
const REST_Y = 0
const START_Y = -70

export function initElastic() {
  const demo = document.getElementById('demo-elastic')
  if (!demo) return

  const readout = document.getElementById('elastic-readout')
  const hint = document.getElementById('hint-elastic')
  const slK = document.getElementById('sl-el-k')
  const slB = document.getElementById('sl-el-b')
  const vlK = document.getElementById('vl-el-k')
  const vlB = document.getElementById('vl-el-b')

  // === Create UI elements ===

  // Container for both lanes
  const lane = document.createElement('div')
  lane.style.cssText = `
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    display: flex;
    pointer-events: none;
  `
  demo.appendChild(lane)

  function createBallLane(label, color, colorAlpha, params) {
    const col = document.createElement('div')
    col.style.cssText = `
      flex: 1;
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    `

    const lbl = document.createElement('div')
    lbl.style.cssText = `
      position: absolute;
      top: 10px;
      font: 600 11px var(--font-mono, monospace);
      color: ${color};
      opacity: 0.8;
    `
    lbl.textContent = label
    col.appendChild(lbl)

    // Rest line
    const rest = document.createElement('div')
    rest.style.cssText = `
      position: absolute;
      left: 20%; right: 20%;
      top: 50%;
      height: 1px;
      background: var(--fg-muted, #8a8a9a);
      opacity: 0.15;
    `
    col.appendChild(rest)

    const ball = document.createElement('div')
    ball.style.cssText = `
      width: ${BALL_SIZE}px;
      height: ${BALL_SIZE}px;
      border-radius: 50%;
      background: ${colorAlpha};
      border: 2px solid ${color};
      will-change: transform;
    `
    col.appendChild(ball)

    const paramEl = document.createElement('div')
    paramEl.style.cssText = `
      position: absolute;
      bottom: 8px;
      font: 11px var(--font-mono, monospace);
      color: var(--fg-muted, #8a8a9a);
    `
    paramEl.textContent = params
    col.appendChild(paramEl)

    lane.appendChild(col)
    return { ball, lbl, paramEl }
  }

  const left = createBallLane('yours', 'rgba(112, 64, 176, 0.9)', 'rgba(112, 64, 176, 0.15)', 'k=500 b=8')
  const right = createBallLane('reference', 'rgba(43, 92, 230, 0.7)', 'rgba(43, 92, 230, 0.1)', 'k=290 b=24')

  // === state ===
  const userY = spring(REST_Y, 0, 500, 8)
  const refY = spring(REST_Y, 0, 290, 24)

  let animatedUntilTime = null
  let userBounces = 0
  let refBounces = 0
  let userLastSign = 0
  let refLastSign = 0

  // === events ===
  const events = { click: false, sliderchange: false }

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

  function getCharacter(k, b) {
    const bCrit = 2 * Math.sqrt(k)
    const ratio = b / bCrit
    if (ratio < 0.4) return 'bouncy'
    if (ratio < 0.8) return 'snappy'
    if (ratio < 1.1) return 'critical'
    return 'heavy'
  }

  function updateParams() {
    const k = slK ? parseFloat(slK.value) : 500
    const b = slB ? parseFloat(slB.value) : 8
    userY.k = k
    userY.b = b
    if (vlK) vlK.textContent = String(Math.round(k))
    if (vlB) vlB.textContent = String(Math.round(b))

    left.lbl.textContent = getCharacter(k, b)
    left.paramEl.textContent = `k=${Math.round(k)} b=${Math.round(b)}`
  }

  // === main render ===
  function render(now) {
    let stillAnimating = false

    if (events.click) {
      userY.pos = START_Y
      userY.dest = REST_Y
      userY.v = 0

      refY.pos = START_Y
      refY.dest = REST_Y
      refY.v = 0

      animatedUntilTime = null
      userBounces = 0
      refBounces = 0
      userLastSign = 0
      refLastSign = 0
      if (hint) hint.style.display = 'none'
    }

    if (events.sliderchange) {
      updateParams()
    }

    // Physics (fixed timestep)
    let newTime = animatedUntilTime ?? now
    const steps = Math.floor((now - newTime) / MS_PER_STEP)
    newTime += steps * MS_PER_STEP

    for (let i = 0; i < steps; i++) {
      springStep(userY)
      springStep(refY)
    }

    // Count bounces
    const uSign = Math.sign(userY.pos - userY.dest)
    if (userLastSign !== 0 && uSign !== 0 && uSign !== userLastSign) userBounces++
    userLastSign = uSign || userLastSign

    const rSign = Math.sign(refY.pos - refY.dest)
    if (refLastSign !== 0 && rSign !== 0 && rSign !== refLastSign) refBounces++
    refLastSign = rSign || refLastSign

    const userAtRest = springAtRest(userY)
    const refAtRest = springAtRest(refY)

    if (userAtRest) springSnap(userY)
    if (refAtRest) springSnap(refY)

    if (!userAtRest || !refAtRest) {
      stillAnimating = true
      animatedUntilTime = newTime
    } else {
      animatedUntilTime = null
    }

    // === DOM write ===
    left.ball.style.transform = `translateY(${userY.pos}px)`
    right.ball.style.transform = `translateY(${refY.pos}px)`

    // Readout
    if (stillAnimating || userBounces > 0 || refBounces > 0) {
      readout.innerHTML =
        `yours: <span class="val">${userBounces}</span> bounces — ` +
        `ref: <span class="val">${refBounces}</span> bounces`
    } else {
      readout.innerHTML = ''
    }

    // Clear events
    events.click = false
    events.sliderchange = false

    return stillAnimating
  }

  // === event listeners ===
  demo.addEventListener('click', () => {
    events.click = true
    scheduleRender()
  })

  if (slK) slK.addEventListener('input', () => { events.sliderchange = true; scheduleRender() })
  if (slB) slB.addEventListener('input', () => { events.sliderchange = true; scheduleRender() })

  updateParams()
  scheduleRender()
}

// Auto-init
if (document.getElementById('demo-elastic')) {
  initElastic()
}
