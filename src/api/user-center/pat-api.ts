import { ucRequest, type UcResponse } from './request'
import { UC_CLIENT_ID } from './client-id'

/**
 * 个人访问令牌（PAT）
 *
 * 对应后端《PAT接口文档》第 5 节「用户自助管理面」：
 * - `POST /user/pat`：用当前登录会话签发一枚 PAT（明文形如 `tlc_pat_<64位hex>`）
 * - `GET  /user/pat/list`：查询我签发的全部 PAT（含已过期记录）
 * - `POST /user/pat/revoke`：按 id 撤销一条
 * - `POST /user/pat/revoke-all`：撤销本人名下全部 PAT
 *
 * 与旧的「自定义有效期 access_token」链路（`/user/oauth/custom-tokens/**`，2026-11-19 已删除）相比：
 * - 签发出来的是 PAT 而不是 access_token，只能用 `/pat/**` 消费，`/oauth2/**` 不认；
 * - 令牌要读哪个游戏账号，写在 `payload.game_uid` 里，签发后不可修改（改账号只能撤销重签）；
 * - 撤销按记录 `id` 定位，不再按明文。
 *
 * 请求体统一用蛇形字段（`expires_in` / `client_id` / `game_uid`），与后端 `@JsonProperty`
 * 声明一致；后端也接受驼峰别名，这里只发一种形态避免歧义。
 */

/**
 * PAT 绑定的自定义结构（`PatPayload`）
 *
 * 后端实体只定义了 `game_uid` / `game_name`，未定义的键在反序列化时被静默忽略，
 * 也不会出现在签发响应与列表里。因此：
 * - `game_uid`：消费端唯一解读的字段，带 `tlc_pat_` 前缀的新令牌读干员数据时必须有值；
 * - `game_name`：仅随签发与列表透传，不参与取数；
 * - `source`：后端当前**没有**这个字段（`PatPayload` 只有前两个），传了会被丢弃。
 *   保留在类型里是为了与后续扩展对齐，不要用它做前端分组依据。
 */
export interface PatPayload {
  /** 要读取的游戏账号 UID（干员数据接口据此定位账号） */
  game_uid?: string | null
  /** 游戏名称，仅透传展示 */
  game_name?: string | null
  /** 游戏账号来源（manual / skland），后端暂未定义该字段，会被忽略 */
  source?: string | null
}

/** 签发 PAT 的响应（`PatIssueVO`） */
export interface PatIssueVO {
  /** 记录主键，撤销按它定位 */
  id: number
  /** 令牌明文，形如 tlc_pat_<64位hex>，共 72 字符 */
  token: string
  /** 令牌前 12 位，仅用于辨认 */
  tokenPrefix: string
  /** 签发时填写的用途名称 */
  name: string
  /** 个人令牌固定 this_land_cloud */
  clientId: string
  /** 本次令牌携带的权限范围，逗号分隔 */
  scope: string
  /** 签发时指定的有效期（秒） */
  expiresIn: number
  /** 到期时间 */
  expireTime: string
  /** 绑定的游戏账号；未传 payload 时为 null 并省略该字段 */
  payload?: PatPayload | null
  /** 签发时间 */
  createdAt: string
}

/** PAT 列表项（`PatVO`），比签发响应多出使用时间与剩余有效期 */
export interface PatVO extends PatIssueVO {
  /** 最近一次使用时间，阶段一恒为 null */
  lastUsedAt?: string | null
  /** 剩余有效期（秒），小于等于 0 即已过期 */
  expiresInSeconds: number
}

/** 签发 PAT 的参数 */
export interface IssuePatParams {
  /** 用途名称，去空白后 1~50 字符 */
  name: string
  /** 有效期（秒），必须大于 0 */
  expiresIn: number
  /** 期望的权限范围（逗号分隔），只能收敛不能扩权；省略取可自助范围全集 */
  scope?: string
  /** 目标客户端，PAT 只支持个人令牌，留空或传平台客户端 */
  clientId?: string
  /** 绑定的游戏账号；读干员数据时必须带 game_uid */
  payload?: PatPayload
}

/**
 * 用当前登录会话签发一枚 PAT（POST /user/pat）
 * 不消费、不轮转任何凭证；签发后明文可随时在列表里回看
 * @param params 签发参数
 */
export function issuePat(params: IssuePatParams): Promise<UcResponse<PatIssueVO>> {
  const body: Record<string, unknown> = {
    name: params.name,
    expires_in: params.expiresIn,
    client_id: params.clientId || UC_CLIENT_ID,
  }
  if (params.scope) body.scope = params.scope
  if (params.payload) body.payload = params.payload
  return ucRequest<PatIssueVO>({
    method: 'POST',
    url: '/user/pat',
    data: body,
  })
}

/**
 * 查询我的 PAT 列表（GET /user/pat/list）
 * 按签发时间倒序，包含已过期记录；过期与否看 expiresInSeconds
 */
export function listPats(): Promise<UcResponse<PatVO[]>> {
  return ucRequest<PatVO[]>({
    method: 'GET',
    url: '/user/pat/list',
  })
}

/**
 * 按 id 撤销一条 PAT（POST /user/pat/revoke）
 * 幂等：id 不存在或不属于本人时返回成功但不删任何行
 * @param id 列表项自带的主键
 */
export function revokePat(id: number): Promise<UcResponse<null>> {
  return ucRequest<null>({
    method: 'POST',
    url: '/user/pat/revoke',
    data: { id },
  })
}

/**
 * 撤销本人名下全部 PAT（POST /user/pat/revoke-all）
 * 无请求体；账号侧安全事件（改密、删除应用）不会联动，只能主动调用
 */
export function revokeAllPats(): Promise<UcResponse<null>> {
  return ucRequest<null>({
    method: 'POST',
    url: '/user/pat/revoke-all',
  })
}
