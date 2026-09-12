export interface Project {
  slug: string
  name: string
  icon: string
  category: string
  description: string
  detail: string
  statusLabel: string
  capabilities: string[]
  savedData: string[]
}

export const projects: Project[] = [
  {
    slug: 'arknights-yituliu',
    name: '明日方舟一图流',
    icon: 'mdi-chart-box-outline',
    category: '明日方舟',
    description: '面向明日方舟的资料、规划与效率工具集合。',
    detail: '使用一图流的各类明日方舟工具，登录后可以保存自己的配置和使用数据。',
    statusLabel: '已入驻',
    capabilities: ['云端保存', '登录后继续使用'],
    savedData: ['个人配置', '工具偏好', '已保存的数据'],
  },
  {
    slug: 'endfield-yituliu',
    name: '终末地一图流',
    icon: 'mdi-compass-outline',
    category: '终末地',
    description: '面向终末地的资料、规划与效率工具集合。',
    detail: '使用终末地一图流的相关工具，登录后可以保存自己的配置和使用数据。',
    statusLabel: '已入驻',
    capabilities: ['云端保存', '跨设备使用'],
    savedData: ['个人配置', '工具偏好', '已保存的数据'],
  },
  {
    slug: 'endfield-industrial-simulator',
    name: '终末地集成工业仿真器',
    icon: 'mdi-factory',
    category: '终末地',
    description: '用于体验和规划集成工业生产安排的仿真工具。',
    detail: '保存你的仿真参数和个人方案，方便下次继续查看和调整。',
    statusLabel: '已入驻',
    capabilities: ['云端保存', '跨设备使用'],
    savedData: ['仿真参数', '个人方案'],
  },
  {
    slug: 'arknights-toolbox',
    name: '明日方舟工具箱',
    icon: 'mdi-toolbox-outline',
    category: '明日方舟',
    description: '收集明日方舟常用的查询、计算和辅助工具。',
    detail: '把常用工具的个人设置保存在云端，换设备后也可以继续使用。',
    statusLabel: '已入驻',
    capabilities: ['云端保存', '登录后继续使用'],
    savedData: ['个人配置', '工具偏好'],
  },
]

export function getProject(slug: string): Project | undefined {
  return projects.find((project) => project.slug === slug)
}
