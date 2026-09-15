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
  connection: ProjectConnection
}

export type ProjectConnectionMode = 'oauth' | 'token' | 'browser-cache'

export type ProjectConnectionStatus = 'authorized' | 'token-ready' | 'synced' | 'not-synced' | 'revoked'

export interface ProjectConnection {
  mode: ProjectConnectionMode
  modeLabel: string
  dataLabel: string
  dataItems: string[]
  permissionLabel: string
  permissionItems: string[]
  status: ProjectConnectionStatus
  statusLabel: string
  statusHint: string
  token?: string
}

export const projects: Project[] = [
  {
    slug: 'arknights-yituliu',
    name: '明日方舟一图流',
    icon: 'mdi-chart-box-outline',
    category: '明日方舟',
    description: '面向明日方舟的资料、规划与效率工具集合。',
    detail: '通过浏览器缓存同步一图流中的个人数据和工具配置。',
    statusLabel: '已入驻',
    capabilities: ['浏览器缓存同步', '工具发起同步'],
    savedData: ['浏览器缓存数据'],
    connection: {
      mode: 'browser-cache',
      modeLabel: '浏览器缓存同步',
      dataLabel: '同步内容',
      dataItems: ['浏览器缓存数据'],
      permissionLabel: '同步方式',
      permissionItems: ['由工具发起同步'],
      status: 'synced',
      statusLabel: '已同步',
      statusHint: '最近同步：今天 14:32',
    },
  },
  {
    slug: 'endfield-yituliu',
    name: '终末地一图流',
    icon: 'mdi-compass-outline',
    category: '终末地',
    description: '面向终末地的资料、规划与效率工具集合。',
    detail: '通过浏览器缓存同步一图流中的个人数据和工具配置。',
    statusLabel: '已入驻',
    capabilities: ['浏览器缓存同步', '工具发起同步'],
    savedData: ['浏览器缓存数据'],
    connection: {
      mode: 'browser-cache',
      modeLabel: '浏览器缓存同步',
      dataLabel: '同步内容',
      dataItems: ['浏览器缓存数据'],
      permissionLabel: '同步方式',
      permissionItems: ['由工具发起同步'],
      status: 'not-synced',
      statusLabel: '未同步',
      statusHint: '等待工具发起同步',
    },
  },
  {
    slug: 'endfield-industrial-simulator',
    name: '终末地集成工业仿真器',
    icon: 'mdi-factory',
    category: '终末地',
    description: '用于体验和规划集成工业生产安排的仿真工具。',
    detail: '通过 OAuth 授权读写你存储在酸橙云中的蓝图等数据。',
    statusLabel: '已入驻',
    capabilities: ['OAuth 授权', '读写云端数据'],
    savedData: ['蓝图等用户存储数据'],
    connection: {
      mode: 'oauth',
      modeLabel: 'OAuth 授权',
      dataLabel: '可访问数据',
      dataItems: ['蓝图等用户存储数据'],
      permissionLabel: '授权范围',
      permissionItems: ['读取用户存储数据', '修改用户存储数据'],
      status: 'authorized',
      statusLabel: '已授权',
      statusHint: '最近访问：今天 13:18',
    },
  },
  {
    slug: 'arknights-toolbox',
    name: '明日方舟工具箱',
    icon: 'mdi-toolbox-outline',
    category: '明日方舟',
    description: '收集明日方舟常用的查询、计算和辅助工具。',
    detail: '使用工具专属 Token 读写你存储在酸橙云中的仓库和干员数据。',
    statusLabel: '已入驻',
    capabilities: ['工具专属 Token', '读写云端数据'],
    savedData: ['仓库数据', '干员数据'],
    connection: {
      mode: 'token',
      modeLabel: '工具专属 Token',
      dataLabel: '可访问数据',
      dataItems: [],
      permissionLabel: '访问范围',
      permissionItems: ['读取仓库数据', '修改仓库数据', '读取干员数据', '修改干员数据'],
      status: 'token-ready',
      statusLabel: 'Token 已生成',
      statusHint: 'Token 已生成，等待工具调用',
      token: 'slc_demo_arknights_7f3c9a2e4b81',
    },
  },
]

export function getProject(slug: string): Project | undefined {
  return projects.find((project) => project.slug === slug)
}
