// Rubber Band Slider — horizontal slider with elastic overdrag
// Dragging past left or right stretches the slider body like rubber,
// then springs back on release. The shape deforms: stretches in X, squishes in Y.

import { onResize } from '../engine/lifecycle.js'
import { demoRGBA } from '../engine/colors.js'

const SPRING_K = 400
const SPRING_B = 42 // overdamped (b_crit = 2*sqrt(400) = 40), fast convergence
const MS_PER_STEP = 4

export function initRubberSlider() {
  const demo = document.getElementById('demo-rubber-slider')
  if (!demo) return

  const readout = document.getElementById('rubber-slider-readout')
  const hint = document.getElementById('hint-rubber-slider')

  // === Build DOM ===
  const wrapper = document.createElement('div')
  wrapper.style.cssText = `
    position:absolute; top:50%; left:50%; transform:translate(-50%,-50%);
    width:min(280px, calc(100% - 64px)); height:48px;
    will-change:transform;
  `
  demo.appendChild(wrapper)

  const track = document.createElement('div')
  track.style.cssText = `
    width:100%; height:100%;
    border-radius:8px; overflow:hidden;
    background:var(--bg);
    border:1px solid var(--border);
    position:relative;
    cursor:grab;
    touch-action:none;
  `
  wrapper.appendChild(track)

  const fill = document.createElement('div')
  fill.style.cssText = `
    position:absolute; top:0; left:0; bottom:0;
    background:${demoRGBA('blue', 0.12)};
    border-right:2px solid ${demoRGBA('blue', 0.5)};
    will-change:width;
    transition:none;
  `
  track.appendChild(fill)

  // Thumb indicator at fill edge
  const thumb = document.createElement('div')
  thumb.style.cssText = `
    position:absolute; top:50%; right:-8px;
    width:16px; height:16px; margin-top:-8px;
    border-radius:50%;
    background:var(--demo-blue);
    box-shadow:0 2px 8px ${demoRGBA('blue', 0.3)};
    pointer-events:none;
  `
  fill.appendChild(thumb)

  const label = document.createElement('div')
  label.style.cssText = `
    position:absolute; top:50%; left:50%; transform:translate(-50%,-50%);
    font:600 0.8rem var(--font-mono);
    color:var(--fg-muted);
    pointer-events:none;
    z-index:2;
  `
  wrapper.appendChild(label)

  // === State ===
  let width = 280
  let progress = 0.5  // 0..1
  let overdrag = 0    // px past boundary
  let overdragVel = 0
  let phase = 'idle'  // 'idle' | 'drag' | 'settle'
  let dragging = false
  let animatedUntilTime = null

  // === Scheduling ===
  let scheduled = false
  function scheduleRender() {
    if (scheduled) return
    scheduled = true
    requestAnimationFrame(function frame(now) {
      scheduled = false
      if (render(now)) scheduleRender()
    })
  }

  // === Spring for overdrag settle ===
  function springStep(dtMs) {
    const dt = dtMs / 1000
    const F = -SPRING_K * overdrag - SPRING_B * overdragVel
    overdragVel += F * dt
    overdrag += overdragVel * dt
  }

  // === Deformation from overdrag ===
  let settleOriginX = '0%' // locked during settle to prevent flicker

  function applyDeformation() {
    const absOD = Math.abs(overdrag)

    // Scale: stretch X, squish Y — using sqrt for diminishing effect
    const stretch = 1 - width / (width - Math.sqrt(absOD) * 2.5)
    const scaleX = 1 - stretch
    const scaleY = 1 + stretch * 1.8

    // Translation in drag direction
    const transX = Math.sqrt(absOD * 8) * (overdrag < 0 ? -1 : 1)

    // Transform origin: update freely during drag, lock during settle
    if (phase === 'drag' && absOD > 1) {
      settleOriginX = overdrag < 0 ? '100%' : '0%'
    }

    wrapper.style.transformOrigin = `${settleOriginX} 50%`
    wrapper.style.transform = `translate(-50%, -50%) scaleX(${scaleX.toFixed(4)}) scaleY(${scaleY.toFixed(4)}) translateX(${transX.toFixed(1)}px)`
  }

  // === Update fill + label ===
  function updateVisuals() {
    const clamped = Math.max(0, Math.min(1, progress))
    fill.style.width = (clamped * 100).toFixed(1) + '%'
    label.textContent = Math.round(clamped * 100) + '%'
    applyDeformation()

    if (readout) {
      if (Math.abs(overdrag) > 1) {
        readout.innerHTML =
          `progress = <span class="val">${Math.round(clamped * 100)}%</span>  ` +
          `overdrag = <span class="val">${overdrag.toFixed(1)}px</span>`
      } else {
        readout.innerHTML = `progress = <span class="val">${Math.round(clamped * 100)}%</span>`
      }
    }
  }

  // === Render ===
  function render(now) {
    let newAnimTime = animatedUntilTime ?? now
    const steps = Math.floor((now - newAnimTime) / MS_PER_STEP)
    newAnimTime += steps * MS_PER_STEP

    if (!dragging && phase === 'settle' && steps > 0) {
      for (let i = 0; i < steps; i++) {
        springStep(MS_PER_STEP)
        if (Math.abs(overdrag) < 0.01 && Math.abs(overdragVel) < 0.01) {
          overdrag = 0
          overdragVel = 0
          phase = 'idle'
          break
        }
      }
    }

    const stillAnimating = phase === 'settle'

    updateVisuals()

    animatedUntilTime = stillAnimating || dragging ? newAnimTime : null
    return stillAnimating || dragging
  }

  // === Pointer events ===
  let lastPointerX = 0

  track.addEventListener('pointerdown', (e) => {
    if (dragging) return
    e.preventDefault()
    dragging = true
    phase = 'drag'
    lastPointerX = e.clientX
    track.setPointerCapture(e.pointerId)
    track.style.cursor = 'grabbing'
    if (hint) hint.style.display = 'none'

    // Tap to set position
    const rect = track.getBoundingClientRect()
    const x = e.clientX - rect.left
    progress = x / width
    overdrag = 0
    overdragVel = 0
    animatedUntilTime = performance.now()
    scheduleRender()
  }, { passive: false })

  function onMove(e) {
    if (!dragging) return
    const dx = e.clientX - lastPointerX
    lastPointerX = e.clientX

    // Convert dx to progress delta
    const rawProgress = progress + dx / width

    if (rawProgress > 1) {
      progress = 1
      overdrag += (rawProgress - 1) * width * 0.15
    } else if (rawProgress < 0) {
      progress = 0
      overdrag += rawProgress * width * 0.15
    } else {
      progress = rawProgress
    }

    scheduleRender()
  }

  function onUp() {
    if (!dragging) return
    dragging = false
    track.style.cursor = 'grab'

    if (Math.abs(overdrag) > 0.5) {
      phase = 'settle'
      overdragVel = 0
      if (!animatedUntilTime) animatedUntilTime = performance.now()
    } else {
      overdrag = 0
      phase = 'idle'
    }
    scheduleRender()
  }

  track.addEventListener('pointermove', onMove)
  track.addEventListener('pointerup', onUp)
  track.addEventListener('pointercancel', onUp)
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onUp)

  // === Init ===
  updateVisuals()
  onResize(() => {
    width = track.clientWidth || 280
    scheduleRender()
  })
}

// Auto-init
if (document.getElementById('demo-rubber-slider')) {
  initRubberSlider()
}
