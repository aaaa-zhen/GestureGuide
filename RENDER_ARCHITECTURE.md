# Chenglou 渲染架构指南

> 基于 chenglou (React Motion 作者) 的渲染模式，用于构建流畅的手势交互动画。

## 核心理念

**事件收集，统一渲染** — 不在事件处理器中直接修改状态，而是收集事件，在单一的 `render()` 函数中按顺序处理所有逻辑。

---

## 架构总览

```
┌─────────────────────────────────────────────────────────┐
│                    Event Listeners                       │
│  pointerdown → events.pointerdown = e; scheduleRender() │
│  pointermove → events.pointermove = e; scheduleRender() │
│  pointerup   → events.pointerup = e;   scheduleRender() │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                    scheduleRender()                      │
│  if (scheduledRender) return  // 防重复                  │
│  scheduledRender = true                                  │
│  requestAnimationFrame(render)                           │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                      render(now)                         │
│                                                          │
│  Step 0: 处理事件 (消费 events 对象)                      │
│  Step 1: 批量 DOM 读取                                   │
│  Step 2: 状态变化 & 布局计算                              │
│  Step 3: 物理模拟 (弹簧动画)                              │
│  Step 4: 批量 DOM 写入                                   │
│  Step 5: 清理事件                                        │
│                                                          │
│  return stillAnimating  // 是否继续下一帧                 │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
              stillAnimating ? scheduleRender() : stop
```

---

## 1. 事件收集模式

### 传统方式 ❌
```javascript
// 事件处理器直接修改状态 — 可能产生竞态条件
demo.addEventListener('pointerdown', (e) => {
  isDown = true
  startX = e.clientX
  updateUI()  // 立即更新
})
```

### Chenglou 方式 ✅
```javascript
// 事件只收集，不处理
const events = {
  pointerdown: null,
  pointermove: null,
  pointerup: null,
}

demo.addEventListener('pointerdown', (e) => {
  events.pointerdown = e  // 只存储
  scheduleRender()        // 触发渲染
})
```

**优点：**
- 避免事件处理中的竞态条件
- 所有状态变化集中在 `render()` 中，易于调试
- 事件顺序可预测

---

## 2. 调度器 (Scheduler)

```javascript
let scheduledRender = false

function scheduleRender() {
  if (scheduledRender) return  // 防止重复调度
  scheduledRender = true
  requestAnimationFrame(function renderAndMaybeScheduleAnotherRender(now) {
    scheduledRender = false
    if (render(now)) scheduleRender()  // render 返回 true 则继续
  })
}
```

**关键点：**
- `scheduledRender` 标志防止同一帧多次调度
- 函数名 `renderAndMaybeScheduleAnotherRender` 便于在 DevTools 中识别
- `render()` 返回 `boolean` 控制是否继续动画

---

## 3. 渲染函数结构

```javascript
function render(now) {
  // ═══ Step 0: 处理事件 ═══
  if (events.pointerdown) {
    const e = events.pointerdown
    pointerState = 'down'
    downX = e.clientX
    downY = e.clientY
    // ... 初始化状态
  }

  if (events.pointermove && pointerState !== 'up') {
    const e = events.pointermove
    // ... 更新拖动位置
  }

  if (events.pointerup) {
    pointerState = 'up'
    // ... 释放处理
  }

  // ═══ Step 1: 批量 DOM 读取 ═══
  const rect = demo.getBoundingClientRect()
  // 所有 DOM 读取集中在这里，避免读写交错

  // ═══ Step 2: 状态 & 布局计算 ═══
  if (pointerState !== 'dragging') {
    sx.dest = (rect.width - W) / 2
    sy.dest = (rect.height - W) / 2
  }

  // ═══ Step 3: 物理模拟 ═══
  let stillAnimating = false
  if (pointerState !== 'dragging') {
    // 固定时间步弹簧模拟
    const steps = Math.floor((now - animatedUntilTime) / MS_PER_STEP)
    for (let i = 0; i < steps; i++) {
      springStep(sx)
      springStep(sy)
    }
    stillAnimating = !springAtRest(sx) || !springAtRest(sy)
  }

  // ═══ Step 4: 批量 DOM 写入 ═══
  box.style.transform = `translate(${sx.pos}px, ${sy.pos}px)`
  readout.textContent = `x = ${Math.round(sx.pos)}`
  // 所有 DOM 写入集中在这里

  // ═══ Step 5: 清理事件 ═══
  events.pointerdown = null
  events.pointermove = null
  events.pointerup = null

  return stillAnimating
}
```

---

## 4. 弹簧物理 (Spring Physics)

### 核心公式
```
F = -k * (pos - dest) - b * v

k = 刚度 (stiffness)  — 值越大，弹簧越硬，回弹越快
b = 阻尼 (damping)    — 值越大，震荡越少，停止越快
```

### 实现
```javascript
const MS_PER_STEP = 4  // 4ms 固定时间步

function spring(pos, v = 0, k = 290, b = 24) {
  return { pos, dest: pos, v, k, b }
}

function springStep(s) {
  const t = MS_PER_STEP / 1000  // 转换为秒
  const Fspring = -s.k * (s.pos - s.dest)  // 弹簧力 (Hooke's law)
  const Fdamper = -s.b * s.v               // 阻尼力
  const a = Fspring + Fdamper              // 加速度 (假设质量为1)
  s.v += a * t                             // 更新速度
  s.pos += s.v * t                         // 更新位置
}

function springAtRest(s) {
  return Math.abs(s.v) < 0.01 && Math.abs(s.dest - s.pos) < 0.01
}

function springSnap(s) {
  s.pos = s.dest
  s.v = 0
}
```

### 固定时间步积分
```javascript
// 将物理模拟与帧率解耦
let animatedUntilTime = null

function runPhysics(now) {
  let newAnimatedUntilTime = animatedUntilTime ?? now
  const steps = Math.floor((now - newAnimatedUntilTime) / MS_PER_STEP)
  newAnimatedUntilTime += steps * MS_PER_STEP

  for (let i = 0; i < steps; i++) {
    springStep(sx)
    springStep(sy)
  }

  animatedUntilTime = stillAnimating ? newAnimatedUntilTime : null
}
```

**为什么用固定时间步？**
- 60fps: 每帧 16.6ms → 约 4 步
- 120fps: 每帧 8.3ms → 约 2 步
- 物理行为一致，不受帧率影响

### 弹簧预设
```javascript
const SPRING = {
  DEFAULT: { k: 290, b: 24 },   // 标准
  GENTLE:  { k: 170, b: 26 },   // 柔和
  WOBBLY:  { k: 180, b: 12 },   // 弹性 (低阻尼)
  STIFF:   { k: 400, b: 28 },   // 硬朗
  SLOW:    { k: 120, b: 14 },   // 缓慢
}
```

调参工具：https://chenglou.me/react-motion/demos/demo5-spring-parameters-chooser/

---

## 5. 指针状态机

```javascript
/** @type {'up' | 'down' | 'dragging'} */
let pointerState = 'up'

// 状态转换
// pointerdown → 'down'
// pointermove + dist > SLOP → 'dragging'
// pointerup → 'up'
```

**状态图：**
```
    pointerdown
  ┌─────────────┐
  │             ▼
  │           down
  │             │
  │             │ move > SLOP
  │             ▼
  │         dragging
  │             │
  │             │ pointerup
  └─────────────┘
        up
```

---

## 6. 指针历史缓冲 (Velocity Tracking)

```javascript
// 环形缓冲区，存储最近 20 个点
let pointer = [{ x: 0, y: 0, time: 0 }]

function pushPointer(x, y, time) {
  pointer.push({ x, y, time })
  if (pointer.length > 20) pointer.shift()
}

function clearPointer() {
  pointer.length = 0
  pointer.push({ x: 0, y: 0, time: 0 })
}

// 计算最近 100ms 内的速度
function getVelocity(now, windowMs = 100) {
  if (pointer.length < 2) return { vx: 0, vy: 0 }

  const last = pointer[pointer.length - 1]
  let i = pointer.length - 1
  while (i > 0 && now - pointer[i].time <= windowMs) i--

  const deltaTime = now - pointer[i].time
  if (deltaTime < 1) return { vx: 0, vy: 0 }

  return {
    vx: (last.x - pointer[i].x) / deltaTime * 1000,  // px/s
    vy: (last.y - pointer[i].y) / deltaTime * 1000,
  }
}
```

---

## 7. 手势常量

```javascript
const GESTURE = {
  TOUCH_SLOP: 10,           // 拖动识别阈值 (px)
  LONG_PRESS_MS: 400,       // 长按触发时间
  TAP_MAX_MS: 300,          // 点击最大时长
  DOUBLE_TAP_MS: 300,       // 双击间隔窗口
  DOUBLE_TAP_DISTANCE: 25,  // 双击最大距离
  VELOCITY_WINDOW_MS: 100,  // 速度计算窗口
}
```

---

## 8. 完整模板

```javascript
// demo-template.js
import { spring, springStep, springSnap, springAtRest, clamp, GESTURE } from './render-loop.js'

const MS_PER_STEP = 4

export function initDemo() {
  const demo = document.getElementById('demo-xxx')
  if (!demo) return

  const box = demo.querySelector('.box')

  // ═══ State ═══
  const sx = spring(0)
  const sy = spring(0)
  let animatedUntilTime = null
  let pointerState = 'up'  // 'up' | 'down' | 'dragging'
  let downX = 0, downY = 0
  let offX = 0, offY = 0

  // ═══ Events (collected, not processed) ═══
  const events = {
    pointerdown: null,
    pointermove: null,
    pointerup: null,
  }

  // ═══ Scheduler ═══
  let scheduledRender = false
  function scheduleRender() {
    if (scheduledRender) return
    scheduledRender = true
    requestAnimationFrame(function renderAndMaybeScheduleAnotherRender(now) {
      scheduledRender = false
      if (render(now)) scheduleRender()
    })
  }

  // ═══ Main Render ═══
  function render(now) {
    const rect = demo.getBoundingClientRect()
    let stillAnimating = false

    // Process events
    if (events.pointerdown) {
      const e = events.pointerdown
      pointerState = 'down'
      downX = e.clientX
      downY = e.clientY
      offX = (e.clientX - rect.left) - sx.pos
      offY = (e.clientY - rect.top) - sy.pos
      sx.v = sy.v = 0
      animatedUntilTime = null
    }

    if (events.pointermove && pointerState !== 'up') {
      const e = events.pointermove
      const dist = Math.hypot(e.clientX - downX, e.clientY - downY)

      if (pointerState === 'down' && dist > GESTURE.TOUCH_SLOP) {
        pointerState = 'dragging'
      }

      if (pointerState === 'dragging') {
        sx.pos = clamp((e.clientX - rect.left) - offX, 0, rect.width - 64)
        sy.pos = clamp((e.clientY - rect.top) - offY, 0, rect.height - 64)
      }
    }

    if (events.pointerup && pointerState !== 'up') {
      pointerState = 'up'
      animatedUntilTime = null
    }

    // Layout
    if (pointerState !== 'dragging') {
      sx.dest = (rect.width - 64) / 2
      sy.dest = (rect.height - 64) / 2
    }

    // Physics
    if (pointerState !== 'dragging') {
      let newTime = animatedUntilTime ?? now
      const steps = Math.floor((now - newTime) / MS_PER_STEP)
      newTime += steps * MS_PER_STEP

      for (const s of [sx, sy]) {
        for (let i = 0; i < steps; i++) springStep(s)
        if (springAtRest(s)) springSnap(s)
        else stillAnimating = true
      }

      animatedUntilTime = stillAnimating ? newTime : null
    }

    // DOM write
    box.style.transform = `translate(${sx.pos}px, ${sy.pos}px)`

    // Clear events
    events.pointerdown = null
    events.pointermove = null
    events.pointerup = null

    return stillAnimating
  }

  // ═══ Event Listeners ═══
  demo.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    demo.setPointerCapture(e.pointerId)
    events.pointerdown = e
    scheduleRender()
  }, { passive: false })

  demo.addEventListener('pointermove', (e) => {
    events.pointermove = e
    scheduleRender()
  })

  demo.addEventListener('pointerup', (e) => {
    events.pointerup = e
    scheduleRender()
  })

  demo.addEventListener('pointercancel', (e) => {
    events.pointerup = e
    scheduleRender()
  })

  // Initial render
  scheduleRender()
}
```

---

## 9. 性能优化要点

### DOM 读写分离
```javascript
// ❌ 读写交错 — 触发强制重排
box.style.left = x + 'px'
const width = box.offsetWidth  // 强制重排
box.style.top = y + 'px'

// ✅ 批量读取，批量写入
const rect = demo.getBoundingClientRect()  // 读
const width = box.offsetWidth              // 读
box.style.left = x + 'px'                  // 写
box.style.top = y + 'px'                   // 写
```

### 使用 transform 代替 top/left
```javascript
// ❌ 触发布局
box.style.left = x + 'px'
box.style.top = y + 'px'

// ✅ 只触发合成
box.style.transform = `translate(${x}px, ${y}px)`
```

### 避免频繁 innerHTML
```javascript
// ❌ 每帧解析 HTML
readout.innerHTML = `x = <span>${x}</span>`

// ✅ 预创建元素，更新 textContent
const xSpan = readout.querySelector('.x-value')
xSpan.textContent = x
```

---

## 10. 调试技巧

### 命名 rAF 回调
```javascript
// 在 DevTools Performance 面板中易于识别
requestAnimationFrame(function renderAndMaybeScheduleAnotherRender(now) {
  // ...
})
```

### 打印事件顺序
```javascript
function render(now) {
  console.log('render', {
    pointerdown: !!events.pointerdown,
    pointermove: !!events.pointermove,
    pointerup: !!events.pointerup,
  })
  // ...
}
```

### 可视化弹簧状态
```javascript
function render(now) {
  // ...
  console.log('spring', {
    pos: sx.pos.toFixed(2),
    dest: sx.dest.toFixed(2),
    v: sx.v.toFixed(2),
    atRest: springAtRest(sx),
  })
}
```

---

## 参考资料

- [chenglou/react-motion](https://github.com/chenglou/react-motion) - 原始灵感来源
- [Spring Parameters Chooser](https://chenglou.me/react-motion/demos/demo5-spring-parameters-chooser/) - 弹簧参数调试工具
- [The Physics Behind Spring Animations](https://blog.maximeheckel.com/posts/the-physics-behind-spring-animations/) - 弹簧物理详解
