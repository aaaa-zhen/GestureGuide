// Scroll-spy: highlights current section in sidebar

export function initScrollSpy() {
  const links = document.querySelectorAll('.sidebar-group a[data-section]')
  if (!links.length) return

  const sections = []
  links.forEach(link => {
    const id = link.dataset.section
    const el = document.getElementById(id)
    if (el) sections.push({ el, link })
  })

  if (!sections.length) return

  function update() {
    const scrollY = window.scrollY + 140

    let active = null
    for (const s of sections) {
      if (s.el.offsetTop <= scrollY) {
        if (!active || s.el.offsetTop > active.el.offsetTop) {
          active = s
        }
      }
    }

    links.forEach(a => a.classList.remove('active'))
    if (active) active.link.classList.add('active')
  }

  window.addEventListener('scroll', update, { passive: true })
  update()

  // Scroll sidebar so the active chapter is visible
  const activeGroup = document.querySelector('.sidebar-group.active-chapter')
  if (activeGroup) {
    const sidebar = activeGroup.closest('.sidebar')
    if (sidebar) {
      const groupTop = activeGroup.offsetTop - sidebar.offsetTop
      const sidebarH = sidebar.clientHeight
      sidebar.scrollTop = groupTop - sidebarH / 3
    }
  }
}
