// Nested Scroll Demo (Chapter 5)
// chenglou-style: shows parent/child scroll containers and event propagation

export function initNestedScroll() {
  const demo = document.getElementById('demo-nested-scroll')
  if (!demo) return

  const outer = document.getElementById('ns-outer')
  const inner = document.getElementById('ns-inner')
  const readout = document.getElementById('ns-readout')
  const hint = document.getElementById('hint-ns')
  const outerIndicator = document.getElementById('ns-outer-indicator')
  const innerIndicator = document.getElementById('ns-inner-indicator')

  let outerFlashTimer = null
  let innerFlashTimer = null

  function flashIndicator(el) {
    el.classList.add('active')
    return setTimeout(() => el.classList.remove('active'), 200)
  }

  // Outer (vertical) scroll listener
  outer.addEventListener('scroll', () => {
    if (hint) hint.style.display = 'none'
    clearTimeout(outerFlashTimer)
    outerFlashTimer = flashIndicator(outerIndicator)

    const scrollTop = Math.round(outer.scrollTop)
    const maxScroll = outer.scrollHeight - outer.clientHeight
    readout.innerHTML =
      `active = <span class="val">parent (vertical)</span>\n` +
      `scrollTop = <span class="val">${scrollTop}</span> / ${maxScroll}`
  })

  // Inner (horizontal) scroll listener
  inner.addEventListener('scroll', () => {
    if (hint) hint.style.display = 'none'
    clearTimeout(innerFlashTimer)
    innerFlashTimer = flashIndicator(innerIndicator)

    const scrollLeft = Math.round(inner.scrollLeft)
    const maxScroll = inner.scrollWidth - inner.clientWidth
    readout.innerHTML =
      `active = <span class="val">child (horizontal)</span>\n` +
      `scrollLeft = <span class="val">${scrollLeft}</span> / ${maxScroll}`

    const atStart = scrollLeft <= 1
    const atEnd = scrollLeft >= maxScroll - 1
    if (atStart || atEnd) {
      inner.classList.add('at-boundary')
    } else {
      inner.classList.remove('at-boundary')
    }
  })
}

// Auto-init
if (document.getElementById('demo-nested-scroll')) {
  initNestedScroll()
}
