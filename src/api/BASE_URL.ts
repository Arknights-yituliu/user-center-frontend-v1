// TCL（UserCenter 统一用户中心）服务地址：本地开发走 127.0.0.1:8080，线上走正式域名
// 森空岛凭证桥接（/skland/*）同样走该域名：它与游戏无关，两个站点共用
export const TCL_BASE_URL =
  import.meta.env.VITE_USE_LOCAL === '1' ? 'http://127.0.0.1:8080' : 'https://auth.yituliu.cn'
