// UC（UserCenter 统一用户中心）服务地址：上线前改为 UC 正式域名（如 https://uc.yituliu.cn）
// export const UC_BASE_URL = 'http://127.0.0.1:8080'
export const UC_BASE_URL = 'https://auth.yituliu.cn'

// 开发环境通过 Vite 代理请求，避免 localhost/127.0.0.1 的 CORS 差异影响本地登录。
export const UC_REQUEST_BASE_URL = import.meta.env.DEV ? '/uc-api' : UC_BASE_URL
