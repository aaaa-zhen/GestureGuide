// Render scheduler — deduplicated rAF

export function createScheduler(renderFn) {
  let scheduled = false
  return function schedule() {
    if (scheduled) return
    scheduled = true
    requestAnimationFrame(function renderAndMaybeLoop(now) {
      scheduled = false
      if (renderFn(now)) schedule()
    })
  }
}
