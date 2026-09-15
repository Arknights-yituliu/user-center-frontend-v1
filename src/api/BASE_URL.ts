// UC（UserCenter 统一用户中心）服务地址：上线前改为 UC 正式域名（如 https://uc.yituliu.cn）
// export const UC_BASE_URL = 'http://127.0.0.1:8080'
export const UC_BASE_URL = 'https://auth.yituliu.cn'

// 一图流后端地址；仅用于凭证桥接和酸橙云保存，外部干员数据直接读取森空岛。
export const BACKEND_BASE_URL =
  import.meta.env.VITE_USE_LOCAL === '1' ? 'http://127.0.0.1:10010' : 'https://backend.yituliu.cn'
