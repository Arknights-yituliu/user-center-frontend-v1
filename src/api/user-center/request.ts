import axios from 'axios'
import type { Method } from 'axios'
import { createMessage } from '../../utils/message'
import { TCL_BASE_URL } from '../BASE_URL'
import { TCL_CLIENT_ID } from './client-id'

/**
 * TCL 会话存储与统一请求封装
 *
 * TCL 会话 token/uid 的本地存取与 tclRequest 请求封装放在本文件，
 * 业务接口（登录、资料、邮箱、OAuth）见 ./user-api。
 */

// 保留已有浏览器存储键，避免改简称使现有会话丢失。
// ---- TCL 会话在浏览器端的存储 key（与站内 OAuth 会话 OAUTH_TOKEN 隔离，避免互相干扰）----
const TCL_TOKEN_KEY = 'UC_TOKEN'
const TCL_UID_KEY = 'UC_UID'
/** OAuth 授权流程的临时 token key：与正式会话 UC_TOKEN 隔离，授权完成回跳第三方前清除，不污染本机已登录会话 */
const TCL_TMP_TOKEN_KEY = 'UC_TMP_TOKEN'

/** TCL 服务统一响应结构 */
export interface TclResponse<T = unknown> {
  code: number
  msg: string
  data: T
}

/** tclRequest 请求配置 */
export interface TclRequestConfig {
  /** HTTP 方法，默认 GET */
  method?: Method
  /** 接口路径（相对 TCL_BASE_URL） */
  url?: string
  /** 请求体数据 */
  data?: unknown
  /** 是否携带 TCL token（Authorization: Bearer），默认 true */
  auth?: boolean
  /** 显式指定 TCL token（如 OAuth 安全登录页的本次会话内存 token），优先级高于本地 localStorage 中的 token */
  token?: string
  /** 自定义服务地址，默认使用当前环境的 TCL 请求地址 */
  baseUrl?: string
  /**
   * 静默模式：失败时不弹全局气泡，由调用方自行展示错误
   * （森空岛凭证桥接与导入页需要把错误汇总到页内底部，避免双份提示）
   */
  silent?: boolean
}

/**
 * 获取本地保存的 TCL 会话 token
 * @returns TCL token，无则为空串
 */
export function getTclToken(): string {
  return localStorage.getItem(TCL_TOKEN_KEY) || ''
}

/**
 * 获取本地保存的 TCL uid
 * @returns TCL uid，无则为空串
 */
export function getTclUid(): string {
  return localStorage.getItem(TCL_UID_KEY) || ''
}

/**
 * 获取 OAuth 授权流程的临时 token（本次登录会话，与正式会话隔离，授权完成后清除）
 * @returns 临时 TCL token，无则为空串
 */
export function getTclTmpToken(): string {
  return localStorage.getItem(TCL_TMP_TOKEN_KEY) || ''
}

/**
 * 保存 OAuth 授权流程的临时 token（不覆盖正式会话 UC_TOKEN）
 * @param token 本次登录返回的 TCL token
 */
export function setTclTmpToken(token: string): void {
  localStorage.setItem(TCL_TMP_TOKEN_KEY, token)
}

/**
 * 清除 OAuth 授权流程的临时 token（授权完成回跳第三方前调用）
 */
export function clearTclTmpToken(): void {
  localStorage.removeItem(TCL_TMP_TOKEN_KEY)
}

/**
 * 保存 TCL 会话（token + uid）
 * @param token TCL 登录返回的会话 token
 * @param uid 用户 id
 */
export function setTclSession(token: string, uid: string | number): void {
  localStorage.setItem(TCL_TOKEN_KEY, token)
  localStorage.setItem(TCL_UID_KEY, uid ? String(uid) : '')
}

/**
 * 清除本地 TCL 会话
 */
export function clearTclSession(): void {
  localStorage.removeItem(TCL_TOKEN_KEY)
  localStorage.removeItem(TCL_UID_KEY)
}

/**
 * TCL 接口统一请求封装：
 * - baseUrl 默认使用当前环境的 TCL 请求地址，可传 baseUrl 覆盖
 * - 所有请求统一携带 TCL-Client-Id 头（平台客户端标识，见 client-id.ts）
 * - 请求头自动携带 Authorization: Bearer <token>（auth=true 且存在 token 时）
 * - 响应统一解析 { code, msg, data }，code !== 200 时提示错误并 reject
 * @param config 请求配置
 * @returns 成功时返回响应体
 */
export function tclRequest<T = unknown>({
  method = 'GET',
  url = '',
  data = null,
  auth = true,
  token = '',
  baseUrl = TCL_BASE_URL,
  silent = false,
}: TclRequestConfig = {}): Promise<TclResponse<T>> {
  return new Promise((resolve, reject) => {
    // 来源客户端标识：登录/注册据此写入会话，其余接口用于客户端维度隔离与审计
    const headers: Record<string, string> = { 'TCL-Client-Id': TCL_CLIENT_ID }
    if (auth) {
      // 读取优先级：显式传入的 token（内存会话）> OAuth 授权流程临时 token > 正式会话 token
      const authToken = token || getTclTmpToken() || getTclToken()
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
      // 保留跨域 Cookie 支持；OAuth 登录回跳通过 tcl_ticket 查询参数传递一次性票据
      withCredentials: true,
    })
      .then((response) => {
        const body = response.data as TclResponse<T>
        if (body && body.code === 200) {
          resolve(body)
        } else {
          const msg = (body && body.msg) || '请求失败'
          if (!silent) createMessage({ text: msg, type: 'error' })
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
        if (!silent) createMessage({ text: `${msg}（${url}）`, type: 'error' })
        reject(error)
      })
  })
}
