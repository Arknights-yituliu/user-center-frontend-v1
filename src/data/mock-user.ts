import type { UcProfileVO } from '../api/uc/uc-api'

/** 开发模式下用于撑开新版个人中心布局的本地资料，不参与生产构建逻辑。 */
export const mockUserProfile: UcProfileVO = {
  uid: 10086123,
  nickname: '一图流体验用户',
  email: 'demo-user@yituliu.cn',
  avatar: null,
  status: 1,
  registerTime: '2026-03-18 14:26:08',
  lastLoginTime: '2026-09-12 10:42:16',
}
