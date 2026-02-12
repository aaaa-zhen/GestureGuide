# Gesture Guide — 开发上下文

## 项目概述

Gesture Guide 是一个交互式教学网站，讲解手势驱动 UI 设计的核心概念。技术栈：**Astro 5 + 原生 JS + Rough.js**（手绘风格 SVG 图表）。

GitHub: https://github.com/aaaa-zhen/GestureGuide

## 章节结构

| 页面 | 路由 | 内容 |
|------|------|------|
| `index.astro` | `/` | 首页 |
| `gestures.astro` | `/gestures/` | Chapter 1: 手势基础（tap, swipe, drag 等） |
| `physics.astro` | `/physics/` | Chapter 2: 物理感觉（momentum, spring, snap, rubber band, bounce-back） |
| `patterns.astro` | `/patterns/` | Chapter 3: 交互模式（carousel, swipe-dismiss, pull-refresh 等） |
| `insights.astro` | `/insights/` | Chapter 4: 设计洞察 |

## 核心架构：Chenglou-Style Render Loop

所有 demo 使用统一的渲染架构（灵感来自 chenglou/react-motion 的思想）：

```
事件收集 → scheduleRender() → render(now) → 物理计算 → DOM 写入 → 清除事件
```

### 关键模式

```js
// 事件不立即处理，只存储
const events = { pointerdown: null, pointermove: null, pointerup: null }

// 单一调度
let scheduledRender = false
function scheduleRender() {
  if (scheduledRender) return
  scheduledRender = true
  requestAnimationFrame(function frame(now) {
    scheduledRender = false
    if (render(now)) scheduleRender()  // 返回 true 则继续动画
  })
}

// render(now) 内部按顺序处理：
// 1. pointerdown → 初始化拖拽状态
// 2. pointermove → 累积位移
// 3. pointerup → 启动物理动画
// 4. 物理步进（spring / decay）
// 5. DOM 写入（transform, readout）
// 6. 清除 events
// 7. return stillAnimating || pointerState === 'dragging'
```

### Pointer 事件处理

所有 demo 使用 `setPointerCapture` + 多重安全保障：

```js
let activePointerId = null

container.addEventListener('pointerdown', (e) => {
  activePointerId = e.pointerId
  container.setPointerCapture(e.pointerId)
  events.pointerdown = e
  scheduleRender()
}, { passive: false })

container.addEventListener('pointermove', (e) => {
  if (e.pointerId !== activePointerId) return
  events.pointermove = e
  scheduleRender()
})

function handlePointerEnd(e) {
  if (pointerState !== 'dragging') return
  activePointerId = null
  events.pointerup = e
  scheduleRender()
}

container.addEventListener('pointerup', handlePointerEnd)
container.addEventListener('pointercancel', handlePointerEnd)
container.addEventListener('lostpointercapture', handlePointerEnd)
document.addEventListener('pointerup', (e) => {
  if (pointerState === 'dragging') handlePointerEnd(e)
})
```

## 物理引擎 (`src/engine/render-loop.js`)

### Spring

```js
spring(pos, v, k, b)      // 创建 { pos, dest, v, k, b }
springStep(s)              // 欧拉积分，dt = 4ms
springAtRest(s)            // |v| < 0.01 && |dest - pos| < 0.01
springSnap(s)              // pos = dest, v = 0
```

- **k (stiffness)**: 越大弹回越快
- **b (damping)**: 越大振荡越少。临界阻尼 b_crit = 2√k

### Rubber Band

```js
rubber(distance, range)    // (d * 0.55 * R) / (R + 0.55 * d)
```

非线性映射：距离越大，每像素的视觉位移越小。`range` 控制渐近线。

### Exponential Decay（momentum 用）

```js
// 解析式，非逐帧
position(t) = p₀ + (v₀/λ)(1 - e^{-λt})
velocity(t) = v₀ · e^{-λt}
// λ = -60 * ln(friction)
```

## 各 Demo 详情

### Momentum (`momentum.js`)

- 60 个 item 的可滚动列表
- 拖拽 + 松手 fling（解析式 exponential decay）
- friction slider 控制摩擦系数
- 速度指示条 + readout

### Decay Prediction (`decay-prediction.js`)

- 可拖拽的圆点，fling 后留下 ghost trail
- 展示 exponential decay 的空间分布（开头间距大，结尾间距小）
- friction slider

### Spring Demo (`spring-demo.js`)

- 可拖拽的 box 连接到锚点
- 拖拽松手后 spring 回弹
- k / b sliders 实时调节
- 显示 spring line + anchor dot

### Elastic (`elastic.js`)

- 点击触发弹性动画（高 stiffness、低 damping → 明显过冲）
- k / b sliders
- 展示弹性用于强调效果

### Snap Points (`snap-points.js`)

- 水平 ticker strip，fling-to-snap
- 速度预测落点 index，exponential decay 动画到目标
- 支持键盘 ArrowLeft/Right + wheel

### Rubber Band (`rubber-band.js`)

- **固定列表**（5 个 item，不可滚动）
- 拖拽过边界 → rubber band 非线性阻力
- 松手 → spring 回弹到 0
- elasticity slider 控制 range 参数
- 边框颜色随 overscroll 变红

### Overscroll / Bounce-Back (`overscroll.js`)

- **可滚动列表**（15 个 item）+ momentum
- 状态机：`idle → dragging → decaying → bouncing`
- **dragging**: scrollY 不 clamp，超出边界用 rubber band 映射显示
- **decaying**: 解析式 exponential decay，越过边界时捕获速度转入 bouncing
- **bouncing**: spring 物理（k=120, b=22，接近临界阻尼），overscroll 距离与速度成正比
- bounce 时不用 rubber band 映射，spring position 直接作为 display
- wheel 滚动支持：边界内有 momentum，越过边界有 bounce

### Diagrams (`ch3-diagrams.js`)

用 Rough.js 绘制手绘风格 SVG 图表：

- **Momentum diagram**: 交互式 friction slider，实时重绘 velocity decay 曲线
- **Spring diagram**: 静态，展示 mass-spring 系统 + F = -kx - bv 公式
- **Snap diagram**: 双场景对比（慢速 vs 快速 → 不同 snap 目标）
- **Rubber Band diagram**: 交互式 resistance coefficient slider，实时重绘曲线 + 采样点 ratio 标注

## 设计决策记录

### Rubber Band Demo：为什么是固定列表？

尝试过多种方案：
1. ❌ 水平拖拽条 → 用户觉得不够直观
2. ❌ 可滚动列表 + momentum + rubber band → 用户觉得不如原版
3. ❌ 恢复原版 number-wheel → 松手回弹有 bug
4. ✅ **固定列表（5 item），只能拖拽，不能滚动** → 最直观地展示 rubber band 阻力

### Overscroll Demo：bounce 参数

- k=120, b=22（接近临界阻尼）→ 几乎无振荡，平滑回弹
- bounce 时不用 rubber band 映射 → overscroll 距离直接与速度成正比
- 从 drag 释放进入 bounce 时，spring 从 rubber-banded display position 开始（无视觉跳跃）
- 从 fling 进入 bounce 时，spring 从边界开始，携带剩余速度

### Snap Points：exponential decay vs spline

曾尝试用 cubic Hermite spline 替代 exponential decay 做 fling 动画，后来回退到 exponential decay（`1 - e^{-λt}`），因为更简单且效果一致。

## 开发环境

```bash
npm run dev          # 启动 Astro dev server (port 4321)
# http://localhost:4321/physics/  → Chapter 2 所有 demo
```

## 文件修改指南

- **新增 demo**: 创建 `src/demos/xxx.js`，在对应 `.astro` 页面 `<script>` 中 import
- **修改物理参数**: `src/engine/render-loop.js` 中的 spring/rubber/clamp 工具函数
- **样式**: `src/styles/demo.css` 中的 `.demo`, `.demo-readout`, `.demo-hint` 等
- **暗色模式**: diagrams 中 `getColors()` 根据 `data-theme` 属性切换颜色
- **生命周期**: `src/engine/lifecycle.js` 提供 `onResize()` 工具

## 当前状态 (2026-02-10)

- Chapter 2 (physics) 的所有 demo 和 diagram 已完成并优化
- 所有 demo 使用 chenglou-style render loop
- favicon 已从三角形改为双圆
- 已推送到 GitHub main 分支
