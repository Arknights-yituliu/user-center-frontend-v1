import { ucRequest, type UcResponse } from './uc-api'

/** OAuth 客户端认证方式 */
export type OAuthClientAuthMethod = 'none' | 'client_secret_post'

/** 当前服务端支持的授权类型 */
export type OAuthGrantType = 'authorization_code' | 'refresh_token'

/** OAuth 客户端信息（GET /user/oauth/client/list、GET /user/oauth/client/{clientId}） */
export interface OAuthClientVO {
  /** 客户端 ID（系统分配，不可修改） */
  clientId: string
  /** 客户端名称 */
  clientName: string
  /** 客户端认证方式：none=公共客户端，client_secret_post=加密客户端 */
  authMethod: OAuthClientAuthMethod
  /** 创建后不可修改的授权类型 */
  grantTypes: OAuthGrantType[]
  /** 回调地址白名单 */
  redirectUris: string[]
  /** 可授权范围 */
  scopes: string[]
  /** 是否强制 PKCE（系统固定开启，不可编辑） */
  requirePkce: boolean
  /** 授权时是否展示确认页（系统固定开启，不可编辑） */
  requireAuthConsent: boolean
  /** 前端 CORS 白名单来源 */
  websiteOrigin: string | null
  /** 所有者是否启用客户端 */
  ownerEnabled: boolean
  /** 管理员是否审批通过；false 表示待审批或已被管理员封禁 */
  adminApproved: boolean
  /** 直连登录 / 直连注册是否开通（仅管理员可设置，只读） */
  directAuthEnabled: boolean
  /** 创建时间 */
  createTime: string
}

/** 注册 / 轮换密钥成功响应（client_secret 明文仅此一次返回） */
export interface OAuthClientSecretVO {
  clientId: string
  /** 公共客户端没有密钥，注册时明确返回 null */
  clientSecret: string | null
  authMethod: OAuthClientAuthMethod
  clientName: string
  ownerEnabled: boolean
  adminApproved: boolean
  /** 直连登录 / 直连注册是否开通（仅管理员可设置，只读） */
  directAuthEnabled: boolean
}

/** 注册客户端请求参数 */
export interface RegisterClientParams {
  /** 客户端名称，≤128 字符 */
  clientName: string
  /** 回调地址白名单（1~10 个，须 https；本地联调可 http://localhost） */
  redirectUris: string[]
  /** 可授权范围（如 user.read；OAuth2 不提供用户邮箱权限） */
  scopes: string[]
  /** 授权类型，必须包含 authorization_code */
  grantTypes: OAuthGrantType[]
  /** 客户端鉴权方式 */
  authMethod: OAuthClientAuthMethod
  /** 网站 Origin，仅用于登记，不会自动加入服务端 CORS 白名单 */
  websiteOrigin?: string
  /** access token 有效期（秒），最小 60；不传使用服务端默认值 */
  accessTokenTtl?: number
  /** refresh token 有效期（秒），最小 300；不传使用服务端默认值 */
  refreshTokenTtl?: number
}

/** 更新客户端请求参数（clientId、authMethod、grantTypes、requirePkce、requireAuthConsent 不可改） */
export interface UpdateClientParams {
  clientName: string
  redirectUris: string[]
  scopes: string[]
  websiteOrigin?: string
  accessTokenTtl?: number
  refreshTokenTtl?: number
}

/**
 * 注册 OAuth 客户端（POST /user/oauth/client/register，文档第 5 节）
 * 加密客户端的 clientSecret 明文仅此一次出现；公共客户端返回 null
 * @param params 注册参数
 */
export function registerOAuthClient(
  params: RegisterClientParams,
): Promise<UcResponse<OAuthClientSecretVO>> {
  return ucRequest<OAuthClientSecretVO>({
    method: 'POST',
    url: '/user/oauth/client/register',
    data: params,
  })
}

/**
 * 查询我的客户端列表（GET /user/oauth/client/list，文档第 6 节）
 * 只返回当前登录用户（owner_uid）名下的客户端，secret 永不下发
 */
export function listOAuthClients(): Promise<UcResponse<OAuthClientVO[]>> {
  return ucRequest<OAuthClientVO[]>({
    method: 'GET',
    url: '/user/oauth/client/list',
  })
}

/**
 * 查询客户端详情（GET /user/oauth/client/{clientId}，文档第 7 节）
 * 归属校验失败返回 80008，不存在返回 90001
 * @param clientId 客户端 ID
 */
export function getOAuthClient(clientId: string): Promise<UcResponse<OAuthClientVO>> {
  return ucRequest<OAuthClientVO>({
    method: 'GET',
    url: `/user/oauth/client/${encodeURIComponent(clientId)}`,
  })
}

/**
 * 更新客户端（POST /user/oauth/client/{clientId}/update，文档第 8 节）
 * clientName、redirectUris、scopes 为完整覆盖；clientId、authMethod、grantTypes 不可修改
 * @param clientId 客户端 ID
 * @param params 完整的可更新字段
 */
export function updateOAuthClient(
  clientId: string,
  params: UpdateClientParams,
): Promise<UcResponse<null>> {
  return ucRequest<null>({
    method: 'POST',
    url: `/user/oauth/client/${encodeURIComponent(clientId)}/update`,
    data: params,
  })
}

/**
 * 轮换客户端密钥（POST /user/oauth/client/{clientId}/rotate-secret，文档第 9 节）
 * 新 secret 明文仅此一次返回；轮换后旧 secret 立即失效
 * @param clientId 客户端 ID
 */
export function rotateOAuthClientSecret(
  clientId: string,
): Promise<UcResponse<OAuthClientSecretVO>> {
  return ucRequest<OAuthClientSecretVO>({
    method: 'POST',
    url: `/user/oauth/client/${encodeURIComponent(clientId)}/rotate-secret`,
  })
}

/**
 * 停用 / 启用客户端（POST /user/oauth/client/{clientId}/disable | /enable，文档第 10~11 节）
 * 停用后该客户端的授权跳转、换 token、刷新全部拒绝（90001）
 * @param clientId 客户端 ID
 * @param enabled true=启用 false=停用
 */
export function setOAuthClientStatus(
  clientId: string,
  enabled: boolean,
): Promise<UcResponse<null>> {
  return ucRequest<null>({
    method: 'POST',
    url: `/user/oauth/client/${encodeURIComponent(clientId)}/${enabled ? 'enable' : 'disable'}`,
  })
}

/**
 * 删除客户端（POST /user/oauth/client/{clientId}/delete，文档第 12 节）
 * 级联吊销该 client 名下全部 access token 和 refresh token，删除不可恢复
 * @param clientId 客户端 ID
 */
export function deleteOAuthClient(clientId: string): Promise<UcResponse<null>> {
  return ucRequest<null>({
    method: 'POST',
    url: `/user/oauth/client/${encodeURIComponent(clientId)}/delete`,
  })
}

/* ===================== 用户授权应用管理（/user/oauth/grants） ===================== */

/** 一次授权记录（= 一个仍有效的 refresh_token） */
export interface OAuthGrantItem {
  /** 授权的权限范围，逗号分隔 */
  scope: string
  /** 授权创建（签发）时间，ISO-8601 格式 */
  createdAt: string
  /** refresh_token 剩余有效期（秒），小于等于 0 视为过期 */
  expiresInSeconds: number
}

/** 按应用（OAuth 客户端）分组后的授权组 */
export interface OAuthGrantGroup {
  /** 应用（OAuth 客户端）ID */
  clientId: string
  /** 应用中文名称 */
  clientName: string
  /** 该应用下的授权条目列表，按授权时间倒序 */
  grants: OAuthGrantItem[]
}

/**
 * 查询我授权过的应用列表（GET /user/oauth/grants）
 * 按应用分组返回当前用户仍有效的授权记录；仅返回走授权码流程签发过 refresh_token 的授权
 */
export function listOAuthGrants(): Promise<UcResponse<OAuthGrantGroup[]>> {
  return ucRequest<OAuthGrantGroup[]>({
    method: 'GET',
    url: '/user/oauth/grants',
  })
}

/**
 * 撤销对某应用的授权（POST /user/oauth/grants/revoke）
 * 按应用整体撤销：作废该应用名下全部 refresh_token 与 access_token，操作幂等
 * @param clientId 要撤销授权的应用（OAuth 客户端）ID
 */
export function revokeOAuthGrant(clientId: string): Promise<UcResponse<null>> {
  return ucRequest<null>({
    method: 'POST',
    url: '/user/oauth/grants/revoke',
    data: { clientId },
  })
}
