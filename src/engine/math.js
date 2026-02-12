// Math utilities

export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v))
}

export function lerp(a, b, t) {
  return a + (b - a) * t
}

export function rubber(distance, range) {
  return (distance * 0.55 * range) / (range + 0.55 * distance)
}
