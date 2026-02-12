// Theme-aware color helper
// Reads CSS custom properties and provides RGB values for demos

let cache = null

function parseHexToRGB(hex) {
  hex = hex.trim().replace('#', '')
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  }
}

function readColors() {
  const style = getComputedStyle(document.documentElement)
  const get = name => style.getPropertyValue(name).trim()
  const rgb = name => {
    const hex = get(name)
    if (!hex) return '0,0,0'
    const { r, g, b } = parseHexToRGB(hex)
    return `${r}, ${g}, ${b}`
  }
  cache = {
    blue: rgb('--demo-blue'),
    green: rgb('--demo-green'),
    orange: rgb('--demo-orange'),
    purple: rgb('--demo-purple'),
    red: rgb('--demo-red'),
    accent: rgb('--accent'),
  }
  return cache
}

/** Get comma-separated RGB string for a demo color name. */
export function demoRGB(name) {
  if (!cache) readColors()
  return cache[name] || '0, 0, 0'
}

/** Get `rgba(r, g, b, a)` string for a demo color. */
export function demoRGBA(name, alpha) {
  return `rgba(${demoRGB(name)}, ${alpha})`
}

// Invalidate cache when theme changes
if (typeof MutationObserver !== 'undefined') {
  const observer = new MutationObserver(() => { cache = null })
  if (document.documentElement) {
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  }
}
