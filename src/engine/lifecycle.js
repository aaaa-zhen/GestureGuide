// Demo lifecycle utilities — auto-cleanup on Astro page transitions

const cleanups = []

export function onResize(fn) {
  window.addEventListener('resize', fn)
  cleanups.push(() => window.removeEventListener('resize', fn))
}

export function onCleanup(fn) {
  cleanups.push(fn)
}

document.addEventListener('astro:before-swap', () => {
  for (const fn of cleanups) fn()
  cleanups.length = 0
})
