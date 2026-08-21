import axios from 'axios'
import type { Method } from 'axios'
import { createMessage } from '../../utils/message'
import { UC_BASE_URL } from '../BASE_URL'

// ---- UC 会话在浏览器端的存储 key（与站内 OAuth 会话 OAUTH_TOKEN 隔离，避免互相干扰）----
const UC_TOKEN_KEY = 'UC_TOKEN'
const UC_UID_KEY = 'UC_UID'

/** UC 服务统一响应结构 */
export interface UcResponse<T = unknown> {
  code: number
  msg: string
  data: T
}

/** 登录/注册成功后返回的会话数据（LoginVO） */
export interface UcSessionVO {
  token: string
  uid: string | number
}

/** 用户资料（GET /user/profile） */
export interface UcProfileVO {
  uid: number
  email: string | null
  nickname: string
  avatar: string | null
  status: number
  registerTime: string
  lastLoginTime: string
}

/** ucRequest 请求配置 */
export interface UcRequestConfig {
  /** HTTP 方法，默认 GET */
  method?: Method
  /** 接口路径（相对 UC_BASE_URL） */
  url?: string
  /** 请求体数据 */
  data?: unknown
  /** 是否携带本地 UC token（Authorization: Bearer），默认 true */
  auth?: boolean
  /** 自定义服务地址，默认 UC_BASE_URL */
  baseUrl?: string
}

/**
 * 获取本地保存的 UC 会话 token
 * @returns UC token，无则为空串
 */
export function getUcToken(): string {
  return localStorage.getItem(UC_TOKEN_KEY) || ''
}

/**
 * 获取本地保存的 UC uid
 * @returns UC uid，无则为空串
 */
export function getUcUid(): string {
  return localStorage.getItem(UC_UID_KEY) || ''
}

/**
 * 保存 UC 会话（token + uid）
 * @param token UC 登录返回的会话 token
 * @param uid 用户 id
 */
export function setUcSession(token: string, uid: string | number): void {
  localStorage.setItem(UC_TOKEN_KEY, token)
  localStorage.setItem(UC_UID_KEY, uid ? String(uid) : '')
}

/**
 * 清除本地 UC 会话
 */
export function clearUcSession(): void {
  localStorage.removeItem(UC_TOKEN_KEY)
  localStorage.removeItem(UC_UID_KEY)
}

/**
 * UC 登出：
 * 1. 调用 UC POST /auth/logout 使服务端会话 token 立即失效（文档 3.7 节）
 * 2. 无论成功与否都清除本地 UC 会话（token 可能已过期/被踢，本地必须清）
 */
export async function logoutUcSession(): Promise<void> {
  try {
    await ucRequest({ method: 'POST', url: '/auth/logout' })
  } catch {
    // 登出失败（如 token 已失效）不阻断本地清除
  } finally {
    clearUcSession()
  }
}

/**
 * 获取当前登录用户资料（UC GET /user/profile，文档 3.3 节）
 */
export function getUserProfile(): Promise<UcResponse<UcProfileVO>> {
  return ucRequest<UcProfileVO>({ method: 'GET', url: '/user/profile' })
}

/**
 * 发送邮箱验证码（UC POST /auth/send-code，文档 3.0 节）
 * 限流：同一 IP 最小间隔 60s，同一邮箱最小间隔 5 分钟
 * @param email 目标邮箱
 * @param usage 用途标识：register=注册/邮箱绑定、login=登录
 */
export function sendEmailCode(email: string, usage = 'register'): Promise<UcResponse> {
  return ucRequest({
    method: 'POST',
    url: '/auth/send-code',
    data: { email, usage },
    auth: false,
  })
}

/**
 * 发送重设密码验证码（UC POST /auth/reset-code，文档 3.5.1 节），验证码发到账号绑定的邮箱
 * @param account 邮箱或用户名
 */
export function sendResetCode(account: string): Promise<UcResponse> {
  return ucRequest({
    method: 'POST',
    url: '/auth/reset-code',
    data: { account },
    auth: false,
  })
}

/**
 * 忘记密码：提交新密码（UC POST /auth/reset-password，文档 3.5.2 节）
 * 成功后服务端踢出该账号全部会话
 * @param account 邮箱或用户名（与发送验证码时一致）
 * @param code 收到的验证码
 * @param newPassword 新密码（6-32 位，仅数字、字母、@、下划线）
 */
export function resetPassword(account: string, code: string, newPassword: string): Promise<UcResponse> {
  return ucRequest({
    method: 'POST',
    url: '/auth/reset-password',
    data: { account, code, newPassword },
    auth: false,
  })
}

/**
 * 修改个人资料（昵称/头像）（UC POST /user/profile/update，需登录）
 * 昵称最长 20 字符、头像地址最长 512；仅传需要修改的字段
 * @param data 修改参数 { nickname?, avatar? }
 */
export function updateProfile(data: { nickname?: string; avatar?: string }): Promise<UcResponse> {
  return ucRequest({
    method: 'POST',
    url: '/user/profile/update',
    data,
  })
}

/**
 * 绑定邮箱（UC POST /user/email/bind，文档 3.6.1 节，需登录，仅无邮箱账号可绑）
 * @param email 新邮箱（全局唯一）
 * @param code 发到该邮箱的验证码（先调 sendEmailCode，usage=register）
 */
export function bindEmail(email: string, code: string): Promise<UcResponse> {
  return ucRequest({
    method: 'POST',
    url: '/user/email/bind',
    data: { email, code },
  })
}

/**
 * 发送换绑邮箱验证码（UC POST /user/email/send-change-code，需登录，无参数）
 * 验证码由服务端发到当前绑定邮箱（前端只持有脱敏邮箱，无需也不能传邮箱）
 * 绑定邮箱发码仍走 sendEmailCode（usage=register）
 */
export function sendChangeEmailCode(): Promise<UcResponse> {
  return ucRequest({
    method: 'POST',
    url: '/user/email/send-change-code',
  })
}

/**
 * 换绑邮箱（UC POST /user/email/change，需登录，验证旧邮箱与新邮箱）
 * 旧邮箱由服务端以当前绑定为准，前端无需（也不应）回传，只需旧邮箱验证码
 * @param oldCode 发到旧邮箱（当前绑定邮箱）的验证码（先调 sendChangeEmailCode）
 * @param newEmail 新邮箱（全局唯一）
 * @param newCode 发到新邮箱的验证码（先调 sendEmailCode，usage=register）
 */
export function changeEmail(
  oldCode: string,
  newEmail: string,
  newCode: string,
): Promise<UcResponse> {
  return ucRequest({
    method: 'POST',
    url: '/user/email/change',
    data: { oldCode, newEmail, newCode },
  })
}

/**
 * UC 接口统一请求封装：
 * - baseUrl 默认使用 UC_BASE_URL，可传 baseUrl 覆盖（dev 环境切换用）
 * - 请求头自动携带 Authorization: Bearer <token>（auth=true 且存在 token 时）
 * - 响应统一解析 { code, msg, data }，code !== 200 时提示错误并 reject
 * @param config 请求配置
 * @returns 成功时返回响应体
 */
export function ucRequest<T = unknown>({
  method = 'GET',
  url = '',
  data = null,
  auth = true,
  baseUrl = UC_BASE_URL,
}: UcRequestConfig = {}): Promise<UcResponse<T>> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = {}
    if (auth) {
      const token = getUcToken()
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
    }
    axios({
      baseURL: baseUrl,
      method,
      url,
      data,
      headers,
      timeout: 15000,
      // 携带跨域 Cookie：登录时接受 UC 的 Set-Cookie（uc_ticket），供 OAuth authorize 回跳识别登录态
      withCredentials: true,
    })
      .then((response) => {
        const body = response.data as UcResponse<T>
        if (body && body.code === 200) {
          resolve(body)
        } else {
          const msg = (body && body.msg) || '请求失败'
          createMessage({ text: msg, type: 'error' })
          reject(body)
        }
      })
      .catch((error: unknown) => {
        let msg = '网络错误'
        if (axios.isAxiosError(error)) {
          if (error.response) {
            msg = `HTTP ${error.response.status}`
          } else if (error.code === 'ECONNABORTED') {
            msg = '请求超时'
          } else if (error.message) {
            msg = error.message
          }
        }
        createMessage({ text: `${msg}（${url}）`, type: 'error' })
        reject(error)
      })
  })
}
