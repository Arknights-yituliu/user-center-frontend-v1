import { tclRequest, type TclResponse } from './request'
import { TCL_CLIENT_ID } from './client-id'

/** 个人访问令牌绑定的游戏账号信息。 */
export interface PatPayload {
  game_uid?: string | null
  game_name?: string | null
}

/** 签发 PAT 的响应。 */
export interface PatIssueVO {
  id: number
  token: string
  tokenPrefix: string
  name: string
  clientId: string
  scope: string
  expiresIn: number
  expireTime: string
  payload?: PatPayload | null
  createdAt: string
}

/** PAT 列表项。 */
export interface PatVO extends PatIssueVO {
  lastUsedAt?: string | null
  expiresInSeconds: number
}

export interface IssuePatParams {
  name: string
  expiresIn: number
  scope?: string
  clientId?: string
  payload?: PatPayload
}

/** 签发一枚个人访问令牌（POST /user/pat）。 */
export function issuePat(params: IssuePatParams): Promise<TclResponse<PatIssueVO>> {
  const data: Record<string, unknown> = {
    name: params.name,
    expires_in: params.expiresIn,
    client_id: params.clientId || TCL_CLIENT_ID,
  }
  if (params.scope) data.scope = params.scope
  if (params.payload) data.payload = params.payload

  return tclRequest<PatIssueVO>({
    method: 'POST',
    url: '/user/pat',
    data,
  })
}

/** 查询当前用户签发的 PAT（GET /user/pat/list）。 */
export function listPats(): Promise<TclResponse<PatVO[]>> {
  return tclRequest<PatVO[]>({
    method: 'GET',
    url: '/user/pat/list',
  })
}

/** 按记录 ID 撤销一枚 PAT（POST /user/pat/revoke）。 */
export function revokePat(id: number): Promise<TclResponse<null>> {
  return tclRequest<null>({
    method: 'POST',
    url: '/user/pat/revoke',
    data: { id },
  })
}

/** 撤销当前用户的全部 PAT（POST /user/pat/revoke-all）。 */
export function revokeAllPats(): Promise<TclResponse<null>> {
  return tclRequest<null>({
    method: 'POST',
    url: '/user/pat/revoke-all',
  })
}
