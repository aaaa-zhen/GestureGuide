// Number wheel (picker) rendering

import { clamp } from './math.js'

export function createNumberWheel(wheelEl, minValue, maxValue, pool = 17) {
  const items = []
  for (let i = 0; i < pool; i++) {
    const el = document.createElement('div')
    el.className = 'lp-item'
    wheelEl.appendChild(el)
    items.push(el)
  }
  return { items, minValue, maxValue, itemHeight: 40 }
}

export function renderNumberWheel(wheel, pos) {
  const shell = wheel.items[0]?.parentElement?.parentElement
  if (!shell) return
  const centerY = (shell.clientHeight - wheel.itemHeight) / 2
  const centerIndex = pos / wheel.itemHeight
  const startIndex = Math.floor(centerIndex) - Math.floor(wheel.items.length / 2)

  for (let i = 0; i < wheel.items.length; i++) {
    const value = startIndex + i
    const offset = value - centerIndex
    const y = centerY + offset * wheel.itemHeight
    const distance = Math.abs(offset)

    if (value < wheel.minValue || value > wheel.maxValue) {
      wheel.items[i].style.visibility = 'hidden'
      continue
    }
    wheel.items[i].style.visibility = 'visible'
    wheel.items[i].textContent = String(value)
    wheel.items[i].style.transform = `translateY(${y}px) scale(${clamp(1 - distance * 0.08, 0.85, 1)})`
    wheel.items[i].style.opacity = String(clamp(1 - distance * 0.22, 0.2, 1))
  }
}
