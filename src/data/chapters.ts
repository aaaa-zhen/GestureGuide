export interface Section {
  id: string
  label: string
  href: string
}

export interface Chapter {
  id: string
  num: string
  label: string
  href: string
  sections: Section[]
}

export type SiteLang = 'en' | 'zh'

const chaptersEn: Chapter[] = [
  {
    id: 'ch0',
    num: '0',
    label: 'Introduction',
    href: '/',
    sections: [
      { id: 'sec-direct', label: 'Direct Manipulation', href: '/#sec-direct' },
      { id: 'sec-feedback', label: 'The Feedback Loop', href: '/#sec-feedback' },
    ],
  },
  {
    id: 'ch1',
    num: '1',
    label: 'Gestures',
    href: '/gestures/',
    sections: [
      { id: 'sec-touchdown', label: 'Touch Down', href: '/gestures/#sec-touchdown' },
      { id: 'sec-tap', label: 'Tap', href: '/gestures/#sec-tap' },
      { id: 'sec-doubletap', label: 'Double Tap', href: '/gestures/#sec-doubletap' },
      { id: 'sec-longpress', label: 'Long Press', href: '/gestures/#sec-longpress' },
      { id: 'sec-swipe', label: 'Swipe', href: '/gestures/#sec-swipe' },
      { id: 'sec-drag', label: 'Drag / Pan', href: '/gestures/#sec-drag' },
      { id: 'sec-axislock', label: 'Axis Lock', href: '/gestures/#sec-axislock' },
      { id: 'sec-pinch', label: 'Pinch / Zoom', href: '/gestures/#sec-pinch' },
      { id: 'sec-fling', label: 'Fling', href: '/gestures/#sec-fling' },
      { id: 'sec-arbitration', label: 'Gesture Competition', href: '/gestures/#sec-arbitration' },
      { id: 'sec-summary', label: 'Putting it together', href: '/gestures/#sec-summary' },
    ],
  },
  {
    id: 'ch2',
    num: '2',
    label: 'Physics Feel',
    href: '/physics/',
    sections: [
      // Part A: After Release
      { id: 'sec-momentum', label: 'Momentum', href: '/physics/#sec-momentum' },
      { id: 'sec-friction', label: 'Friction', href: '/physics/#sec-friction' },
      { id: 'sec-decay', label: 'Decay Prediction', href: '/physics/#sec-decay' },
      // Part B: Springs
      { id: 'sec-spring', label: 'Springs', href: '/physics/#sec-spring' },
      { id: 'sec-elastic', label: 'Elastic', href: '/physics/#sec-elastic' },
      { id: 'sec-snap', label: 'Snap Points', href: '/physics/#sec-snap' },
      // Part C: Boundaries
      { id: 'sec-rubber', label: 'Rubber Band / Overscroll', href: '/physics/#sec-rubber' },
      { id: 'sec-bounce', label: 'Bounce-Back', href: '/physics/#sec-bounce' },
      { id: 'sec-physics-summary', label: 'Putting it together', href: '/physics/#sec-physics-summary' },
    ],
  },
  {
    id: 'ch3',
    num: '3',
    label: 'Interaction Patterns',
    href: '/patterns/',
    sections: [
      { id: 'sec-pull-refresh', label: 'Pull to Refresh', href: '/patterns/#sec-pull-refresh' },
      { id: 'sec-carousel', label: 'Carousel', href: '/patterns/#sec-carousel' },
      { id: 'sec-reorder', label: 'Draggable Grid', href: '/patterns/#sec-reorder' },
      { id: 'sec-rubber-slider', label: 'Rubber Band Slider', href: '/patterns/#sec-rubber-slider' },
    ],
  },
  {
    id: 'ch4',
    num: '4',
    label: 'Design Insights',
    href: '/insights/',
    sections: [
      { id: 'sec-spatial', label: 'Spatial Consistency', href: '/insights/#sec-spatial' },
      { id: 'sec-frequency', label: 'Frequency & Novelty', href: '/insights/#sec-frequency' },
      { id: 'sec-visibility', label: 'Touch Visibility', href: '/insights/#sec-visibility' },
      { id: 'sec-discoverability', label: 'Discoverability', href: '/insights/#sec-discoverability' },
      { id: 'sec-a11y', label: 'Accessibility', href: '/insights/#sec-a11y' },
      { id: 'sec-references', label: 'References', href: '/insights/#sec-references' },
    ],
  },
]

const chaptersZh: Chapter[] = [
  {
    id: 'ch0',
    num: '0',
    label: '导言',
    href: '/zh/',
    sections: [
      { id: 'sec-direct', label: '直接操控', href: '/zh/#sec-direct' },
      { id: 'sec-feedback', label: '反馈闭环', href: '/zh/#sec-feedback' },
    ],
  },
  {
    id: 'ch1',
    num: '1',
    label: '手势',
    href: '/zh/gestures/',
    sections: [
      { id: 'sec-touchdown', label: '触摸开始', href: '/zh/gestures/#sec-touchdown' },
      { id: 'sec-tap', label: '单击', href: '/zh/gestures/#sec-tap' },
      { id: 'sec-doubletap', label: '双击', href: '/zh/gestures/#sec-doubletap' },
      { id: 'sec-longpress', label: '长按', href: '/zh/gestures/#sec-longpress' },
      { id: 'sec-swipe', label: '滑动', href: '/zh/gestures/#sec-swipe' },
      { id: 'sec-drag', label: '拖拽 / 平移', href: '/zh/gestures/#sec-drag' },
      { id: 'sec-axislock', label: '轴向锁定', href: '/zh/gestures/#sec-axislock' },
      { id: 'sec-pinch', label: '捏合 / 缩放', href: '/zh/gestures/#sec-pinch' },
      { id: 'sec-fling', label: '甩动', href: '/zh/gestures/#sec-fling' },
      { id: 'sec-arbitration', label: '手势竞争', href: '/zh/gestures/#sec-arbitration' },
      { id: 'sec-summary', label: '综合小结', href: '/zh/gestures/#sec-summary' },
    ],
  },
  {
    id: 'ch2',
    num: '2',
    label: '物理手感',
    href: '/zh/physics/',
    sections: [
      { id: 'sec-momentum', label: '动量', href: '/zh/physics/#sec-momentum' },
      { id: 'sec-friction', label: '摩擦', href: '/zh/physics/#sec-friction' },
      { id: 'sec-decay', label: '衰减预测', href: '/zh/physics/#sec-decay' },
      { id: 'sec-spring', label: '弹簧', href: '/zh/physics/#sec-spring' },
      { id: 'sec-elastic', label: '弹性', href: '/zh/physics/#sec-elastic' },
      { id: 'sec-snap', label: '吸附点', href: '/zh/physics/#sec-snap' },
      { id: 'sec-rubber', label: '橡皮筋 / 超滚动', href: '/zh/physics/#sec-rubber' },
      { id: 'sec-bounce', label: '回弹', href: '/zh/physics/#sec-bounce' },
      { id: 'sec-physics-summary', label: '综合小结', href: '/zh/physics/#sec-physics-summary' },
    ],
  },
  {
    id: 'ch3',
    num: '3',
    label: '交互模式',
    href: '/zh/patterns/',
    sections: [
      { id: 'sec-pull-refresh', label: '下拉刷新', href: '/zh/patterns/#sec-pull-refresh' },
      { id: 'sec-carousel', label: '轮播', href: '/zh/patterns/#sec-carousel' },
      { id: 'sec-reorder', label: '可拖拽网格', href: '/zh/patterns/#sec-reorder' },
      { id: 'sec-rubber-slider', label: '橡皮筋滑杆', href: '/zh/patterns/#sec-rubber-slider' },
    ],
  },
  {
    id: 'ch4',
    num: '4',
    label: '设计洞察',
    href: '/zh/insights/',
    sections: [
      { id: 'sec-spatial', label: '空间一致性', href: '/zh/insights/#sec-spatial' },
      { id: 'sec-frequency', label: '频率与新鲜感', href: '/zh/insights/#sec-frequency' },
      { id: 'sec-visibility', label: '触摸可见性', href: '/zh/insights/#sec-visibility' },
      { id: 'sec-discoverability', label: '可发现性', href: '/zh/insights/#sec-discoverability' },
      { id: 'sec-a11y', label: '可访问性', href: '/zh/insights/#sec-a11y' },
      { id: 'sec-references', label: '参考资料', href: '/zh/insights/#sec-references' },
    ],
  },
]

export function getChapters(lang: SiteLang): Chapter[] {
  return lang === 'zh' ? chaptersZh : chaptersEn
}

export const chapters: Chapter[] = chaptersEn
