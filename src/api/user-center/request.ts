import axios from 'axios'
import type { Method } from 'axios'
import { createMessage } from '../../utils/message'
import { UC_BASE_URL } from '../BASE_URL'

/**
 * UC 会话存储与统一请求封装
 *
 * UC 会话 token/uid 的本地存取与 ucRequest 请求封装放在本文件，
 * 业务接口（登录、资料、邮箱、OAuth）见 ./user-api。
 */

// ---- UC 会话在浏览器端的存储 key（与站内 OAuth 会话 OAUTH_TOKEN 隔离，避免互相干扰）----
const UC_TOKEN_KEY = 'UC_TOKEN'
const UC_UID_KEY = 'UC_UID'
/** OAuth 授权流程的临时 token key：与正式会话 UC_TOKEN 隔离，授权完成回跳第三方前清除，不污染本机已登录会话 */
const UC_TMP_TOKEN_KEY = 'UC_TMP_TOKEN'

/** UC 服务统一响应结构 */
export interface UcResponse<T = unknown> {
  code: number
  msg: string
  data: T
}

/** ucRequest 请求配置 */
export interface UcRequestConfig {
  /** HTTP 方法，默认 GET */
  method?: Method
  /** 接口路径（相对 UC_BASE_URL） */
  url?: string
  /** 请求体数据 */
  data?: unknown
  /** 是否携带 UC token（Authorization: Bearer），默认 true */
  auth?: boolean
  /** 显式指定 UC token（如 OAuth 安全登录页的本次会话内存 token），优先级高于本地 localStorage 中的 token */
  token?: string
  /** 自定义服务地址，默认使用当前环境的 UC 请求地址 */
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
 * 获取 OAuth 授权流程的临时 token（本次登录会话，与正式会话隔离，授权完成后清除）
 * @returns 临时 UC token，无则为空串
 */
export function getUcTmpToken(): string {
  return localStorage.getItem(UC_TMP_TOKEN_KEY) || ''
}

/**
 * 保存 OAuth 授权流程的临时 token（不覆盖正式会话 UC_TOKEN）
 * @param token 本次登录返回的 UC token
 */
export function setUcTmpToken(token: string): void {
  localStorage.setItem(UC_TMP_TOKEN_KEY, token)
}

/**
 * 清除 OAuth 授权流程的临时 token（授权完成回跳第三方前调用）
 */
export function clearUcTmpToken(): void {
  localStorage.removeItem(UC_TMP_TOKEN_KEY)
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
 * UC 接口统一请求封装：
 * - baseUrl 默认使用当前环境的 UC 请求地址，可传 baseUrl 覆盖
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
  token = '',
  baseUrl = UC_BASE_URL,
}: UcRequestConfig = {}): Promise<UcResponse<T>> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = {}
    if (auth) {
      // 读取优先级：显式传入的 token（内存会话）> OAuth 授权流程临时 token > 正式会话 token
      const authToken = token || getUcTmpToken() || getUcToken()
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`
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
