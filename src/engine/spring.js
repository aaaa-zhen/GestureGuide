// Spring physics

export function spring(pos, v, k, b) {
  return { pos, dest: pos, v: v || 0, k: k || 290, b: b || 24 }
}

export function springStep(s, dt) {
  const F = -s.k * (s.pos - s.dest) + -s.b * s.v
  s.v += F * dt
  s.pos += s.v * dt
}

export function springGoToEnd(s) {
  s.pos = s.dest
  s.v = 0
}
