// Animated Tap Timeline Diagram
// Shows: DOWN + UP = TAP (with conditions)

export function drawAnimatedTapTimeline(containerId) {
  const container = document.getElementById(containerId)
  if (!container) return

  // Create canvas
  const canvas = document.createElement('canvas')
  canvas.style.cssText = 'width:100%;height:auto;display:block;'
  container.appendChild(canvas)
  const ctx = canvas.getContext('2d')

  const W = 450
  const H = 90
  const dpr = Math.max(1, Math.round(window.devicePixelRatio || 1))
  canvas.width = W * dpr
  canvas.height = H * dpr
  canvas.style.maxWidth = W + 'px'
  ctx.scale(dpr, dpr)

  // Colors
  const COLORS = {
    red: '#e74c3c',
    green: '#27ae60',
    blue: '#6366f1',
    orange: '#d4820a',
    muted: '#8a8a9a',
  }

  // Animation timing
  const CYCLE_DURATION = 3000

  // Animated values
  let downValue = 0
  let upValue = 0
  let resultValue = 0

  let startTime = null

  function lerp(a, b, t) {
    return a + (b - a) * t
  }

  function smoothstep(t) {
    return t * t * (3 - 2 * t)
  }

  function getTargets(elapsed) {
    const t = elapsed % CYCLE_DURATION

    let down = 0, up = 0, result = 0

    // DOWN appears at 200ms
    if (t >= 200) down = Math.min(1, (t - 200) / 300)
    // UP appears at 700ms
    if (t >= 700) up = Math.min(1, (t - 700) / 300)
    // Result appears at 1200ms
    if (t >= 1200) result = Math.min(1, (t - 1200) / 300)

    // Fade out at end
    if (t >= 2500) {
      const fade = 1 - (t - 2500) / 400
      down *= fade
      up *= fade
      result *= fade
    }

    return { down, up, result }
  }

  function render(now) {
    if (!startTime) startTime = now
    const elapsed = now - startTime

    const targets = getTargets(elapsed)

    // Smooth interpolation
    const speed = 0.12
    downValue = lerp(downValue, targets.down, speed)
    upValue = lerp(upValue, targets.up, speed)
    resultValue = lerp(resultValue, targets.result, speed)

    ctx.clearRect(0, 0, W, H)

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
    const mutedColor = isDark ? '#555' : '#ccc'
    const textMuted = isDark ? '#666' : '#aaa'

    // Layout: DOWN + UP = TAP
    const y = 40
    const downX = 60
    const plusX = 120
    const upX = 180
    const equalsX = 255
    const resultX = 350

    // Draw DOWN circle
    const downScale = 0.7 + 0.3 * smoothstep(downValue)
    ctx.save()
    ctx.translate(downX, y)
    ctx.scale(downScale, downScale)

    ctx.beginPath()
    ctx.arc(0, 0, 24, 0, Math.PI * 2)
    ctx.fillStyle = downValue > 0.5
      ? COLORS.red + Math.round(downValue * 35).toString(16).padStart(2, '0')
      : (isDark ? '#333' : '#f0f0f0')
    ctx.fill()
    ctx.strokeStyle = downValue > 0.5 ? COLORS.red : mutedColor
    ctx.lineWidth = downValue > 0.5 ? 2 : 1
    ctx.stroke()

    ctx.font = '600 10px "JetBrains Mono", monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = downValue > 0.5 ? COLORS.red : textMuted
    ctx.fillText('DOWN', 0, 0)
    ctx.restore()

    // Draw "+"
    ctx.font = '600 20px "JetBrains Mono", monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = (downValue > 0.5 && upValue > 0.5) ? COLORS.muted : textMuted
    ctx.fillText('+', plusX, y)

    // Draw UP circle
    const upScale = 0.7 + 0.3 * smoothstep(upValue)
    ctx.save()
    ctx.translate(upX, y)
    ctx.scale(upScale, upScale)

    ctx.beginPath()
    ctx.arc(0, 0, 24, 0, Math.PI * 2)
    ctx.fillStyle = upValue > 0.5
      ? COLORS.green + Math.round(upValue * 35).toString(16).padStart(2, '0')
      : (isDark ? '#333' : '#f0f0f0')
    ctx.fill()
    ctx.strokeStyle = upValue > 0.5 ? COLORS.green : mutedColor
    ctx.lineWidth = upValue > 0.5 ? 2 : 1
    ctx.stroke()

    ctx.font = '600 10px "JetBrains Mono", monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = upValue > 0.5 ? COLORS.green : textMuted
    ctx.fillText('UP', 0, 0)
    ctx.restore()

    // Draw "="
    ctx.font = '600 20px "JetBrains Mono", monospace'
    ctx.textAlign = 'center'
    ctx.fillStyle = resultValue > 0.5 ? COLORS.muted : textMuted
    ctx.fillText('=', equalsX, y)

    // Draw TAP result
    const resultScale = 0.8 + 0.2 * smoothstep(resultValue) + 0.02 * Math.sin(now / 200) * resultValue
    ctx.save()
    ctx.translate(resultX, y)
    ctx.scale(resultScale, resultScale)

    ctx.beginPath()
    ctx.roundRect(-45, -22, 90, 44, 8)
    ctx.fillStyle = resultValue > 0.5
      ? COLORS.blue + Math.round(resultValue * 30).toString(16).padStart(2, '0')
      : (isDark ? '#333' : '#f0f0f0')
    ctx.fill()
    ctx.strokeStyle = resultValue > 0.5 ? COLORS.blue : mutedColor
    ctx.lineWidth = resultValue > 0.5 ? 2 : 1
    ctx.stroke()

    ctx.font = '700 16px "JetBrains Mono", monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = resultValue > 0.5 ? COLORS.blue : textMuted
    ctx.fillText('TAP', 0, 0)
    ctx.restore()

    // Draw conditions below
    ctx.font = '500 9px "JetBrains Mono", monospace'
    ctx.textAlign = 'center'
    const condAlpha = Math.min(upValue, resultValue)
    ctx.fillStyle = condAlpha > 0.5 ? COLORS.orange : textMuted
    ctx.fillText('< 300ms  •  < 10px', (downX + upX) / 2 + 30, y + 38)

    requestAnimationFrame(render)
  }

  requestAnimationFrame(render)
}
