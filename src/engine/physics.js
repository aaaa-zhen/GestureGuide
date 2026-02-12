// Fixed-step simulation loop

import { springStep } from './spring.js'

export const MS_PER_STEP = 4

const prefersReducedMotion = typeof window !== 'undefined'
  ? window.matchMedia('(prefers-reduced-motion: reduce)')
  : { matches: false }

export function stepSprings(springs, now, state) {
  if (prefersReducedMotion.matches) {
    for (const s of springs) { s.pos = s.dest; s.v = 0 }
    return { stillAnimating: false, animatedUntilTime: now }
  }

  let newAnimatedUntilTime = state.animatedUntilTime ?? now
  const steps = Math.min(Math.floor((now - newAnimatedUntilTime) / MS_PER_STEP), 500)
  const dt = MS_PER_STEP / 1000
  let stillAnimating = false

  if (steps > 0) {
    for (let i = 0; i < steps; i++) {
      for (const s of springs) {
        springStep(s, dt)
      }
    }
    for (const s of springs) {
      if (Math.abs(s.v) < 0.01 && Math.abs(s.pos - s.dest) < 0.01) {
        s.pos = s.dest
        s.v = 0
      }
    }
  }

  for (const s of springs) {
    if (s.v !== 0 || s.pos !== s.dest) stillAnimating = true
  }

  newAnimatedUntilTime += Math.max(0, steps) * MS_PER_STEP
  return { stillAnimating, animatedUntilTime: newAnimatedUntilTime }
}
