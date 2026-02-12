// Pointer velocity tracker with ring buffer

export function createPointerTracker() {
  let h = []
  return {
    push(x, y, time) {
      h.push({ x, y, t: time ?? performance.now() })
      if (h.length > 20) h.shift()
    },
    reset() { h = [] },
    last() { return h[h.length - 1] || { x: 0, y: 0, t: 0 } },
    velocity(now) {
      if (h.length < 2) return { vx: 0, vy: 0 }
      now = now ?? h[h.length - 1].t
      let i = h.length - 1
      while (i > 0 && now - h[i].t < 100) i--
      const oldest = h[i]
      const newest = h[h.length - 1]
      const dt = newest.t - oldest.t
      if (dt < 1) return { vx: 0, vy: 0 }
      return {
        vx: (newest.x - oldest.x) / dt * 1000,
        vy: (newest.y - oldest.y) / dt * 1000,
      }
    },
  }
}
