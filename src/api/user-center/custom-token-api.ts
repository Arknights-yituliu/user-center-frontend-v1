import { ucRequest, type UcResponse } from './request'
import { UC_CLIENT_ID } from './client-id'

/**
 * 自定义有效期令牌（直签 access_token）
 *
 * 对应后端文档《OAuth令牌直签接口文档》第 3~12 节：
 * - `POST /user/oauth/custom-tokens`：用当前登录会话直签指定有效期的 access_token
 * - `GET  /user/oauth/custom-tokens`：查询我签发的全部自定义令牌（含已过期记录）
 * - `POST /user/oauth/custom-tokens/revoke`：吊销其中一条（立即失效并删除签发记录）
 *
 * 注意：签发接口的 `scope` 只能收敛、不能扩权，超出凭证已有范围会返回 90003；
 * 请求参数为下划线命名，因此这里用 URLSearchParams 以 form-urlencoded 提交。
 */

/** 直签成功返回的令牌信息（字段为下划线命名，与后端一致） */
export interface CustomTokenVO {
  /** 新签发的 access_token 明文 */
  access_token: string
  /** 固定 Bearer */
  token_type: string
  /** 实际有效期（秒），即请求值 */
  expires_in: number
  /** 本次令牌实际携带的权限，逗号分隔 */
  scope: string
}

/** 自定义令牌签发记录（GET /user/oauth/custom-tokens 的列表项） */
export interface CustomTokenRecordVO {
  /** 记录主键 */
  id: number
  /** 目标客户端 ID */
  clientId: string | null
  /** 应用名称；应用被删除/停用时为空 */
  clientName: string | null
  /** 签发时填写的名称 */
  name: string
  /** access_token 明文 */
  token: string
  /** 本次令牌携带的权限范围，逗号分隔 */
  scope: string
  /** 签发时指定的有效期（秒） */
  expiresIn: number
  /** 到期时间 */
  expireTime: string
  /** 签发时间 */
  createdAt: string
  /** 剩余有效期（秒），小于等于 0 即已过期 */
  expiresInSeconds: number
}

/** 直签参数 */
export interface SignCustomTokenParams {
  /** 期望有效期（秒），必须大于 0 */
  expiresIn: number
  /** 本次签发的名称，去空白后 1~50 字符 */
  name: string
  /** 期望收敛到的权限范围（逗号分隔）；省略表示沿用凭证原有范围 */
  scope?: string
  /** 目标客户端 ID，默认取平台客户端 UC_CLIENT_ID */
  clientId?: string
}

/**
 * 用当前登录会话签发指定有效期的 access_token（POST /user/oauth/custom-tokens）
 * 不消费、不轮转任何凭证；成功后额外落一条签发记录供列表回看
 * @param params 直签参数
 */
export function signCustomToken(
  params: SignCustomTokenParams,
): Promise<UcResponse<CustomTokenVO>> {
  const body = new URLSearchParams()
  body.set('expires_in', String(params.expiresIn))
  body.set('name', params.name)
  body.set('client_id', params.clientId || UC_CLIENT_ID)
  if (params.scope) body.set('scope', params.scope)
  return ucRequest<CustomTokenVO>({
    method: 'POST',
    url: '/user/oauth/custom-tokens',
    data: body,
  })
}

/**
 * 查询我的自定义令牌列表（GET /user/oauth/custom-tokens）
 * 按签发时间倒序，包含已过期记录；过期与否看 expiresInSeconds
 */
export function listCustomTokens(): Promise<UcResponse<CustomTokenRecordVO[]>> {
  return ucRequest<CustomTokenRecordVO[]>({
    method: 'GET',
    url: '/user/oauth/custom-tokens',
  })
}

/**
 * 吊销我的一条自定义令牌（POST /user/oauth/custom-tokens/revoke）
 * 只按 uid 限定，可跨应用吊销；令牌立即失效并删除签发记录，幂等
 * @param token 待吊销的 access_token 明文
 */
export function revokeCustomToken(token: string): Promise<UcResponse<null>> {
  return ucRequest<null>({
    method: 'POST',
    url: '/user/oauth/custom-tokens/revoke',
    data: { token },
  })
}
