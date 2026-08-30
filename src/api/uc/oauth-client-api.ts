import { ucRequest, type UcResponse } from './uc-api'

/** OAuth 客户端信息（GET /oauth2/client/list、GET /oauth2/client/{clientId}） */
export interface OAuthClientVO {
  /** 客户端 ID（系统分配，不可修改） */
  clientId: string
  /** 客户端名称 */
  clientName: string
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
  /** 状态：1=启用 0=停用 */
  status: number
  /** 管理员封禁：0=正常 1=封禁（优先级高于 status，用户不可解除） */
  adminBanned: number
  /** 创建时间 */
  createTime: string
}

/** 注册 / 轮换密钥成功响应（client_secret 明文仅此一次返回） */
export interface OAuthClientSecretVO {
  clientId: string
  clientSecret: string
  clientName?: string
  status?: number
}

/** 注册客户端请求参数 */
export interface RegisterClientParams {
  /** 客户端名称，≤128 字符 */
  clientName: string
  /** 回调地址白名单（1~10 个，须 https；本地联调可 http://localhost） */
  redirectUris: string[]
  /** 可授权范围（如 user.read、user.email） */
  scopes: string[]
  /** 授权类型，默认 ["authorization_code","refresh_token"] */
  grantTypes?: string[]
  /** 客户端鉴权方式，默认 client_secret_post */
  authMethod?: string
  /** 前端 CORS 白名单来源 origin */
  websiteOrigin?: string
}

/** 更新客户端请求参数（clientId、authMethod、grantTypes、requirePkce、requireAuthConsent 不可改） */
export interface UpdateClientParams {
  clientName?: string
  redirectUris?: string[]
  scopes?: string[]
  websiteOrigin?: string
}

/**
 * 注册 OAuth 客户端（POST /oauth2/client/register，文档 3.1）
 * 成功返回的 clientSecret 明文仅此一次出现，需立即妥善保存
 * @param params 注册参数
 */
export function registerOAuthClient(params: RegisterClientParams): Promise<UcResponse<OAuthClientSecretVO>> {
  return ucRequest<OAuthClientSecretVO>({
    method: 'POST',
    url: '/oauth2/client/register',
    data: params,
  })
}

/**
 * 查询我的客户端列表（GET /oauth2/client/list，文档 3.2）
 * 只返回当前登录用户（owner_uid）名下的客户端，secret 永不下发
 */
export function listOAuthClients(): Promise<UcResponse<OAuthClientVO[]>> {
  return ucRequest<OAuthClientVO[]>({
    method: 'GET',
    url: '/oauth2/client/list',
  })
}

/**
 * 查询客户端详情（GET /oauth2/client/{clientId}，文档 3.3）
 * 归属校验失败返回 80008，不存在返回 90001
 * @param clientId 客户端 ID
 */
export function getOAuthClient(clientId: string): Promise<UcResponse<OAuthClientVO>> {
  return ucRequest<OAuthClientVO>({
    method: 'GET',
    url: `/oauth2/client/${encodeURIComponent(clientId)}`,
  })
}

/**
 * 更新客户端（POST /oauth2/client/{clientId}/update，文档 3.4）
 * clientId、authMethod、grantTypes 不可修改
 * @param clientId 客户端 ID
 * @param params 可更新字段
 */
export function updateOAuthClient(clientId: string, params: UpdateClientParams): Promise<UcResponse<null>> {
  return ucRequest<null>({
    method: 'POST',
    url: `/oauth2/client/${encodeURIComponent(clientId)}/update`,
    data: params,
  })
}

/**
 * 轮换客户端密钥（POST /oauth2/client/{clientId}/rotate-secret，文档 3.5）
 * 新 secret 明文仅此一次返回；轮换后旧 secret 立即失效
 * @param clientId 客户端 ID
 */
export function rotateOAuthClientSecret(clientId: string): Promise<UcResponse<OAuthClientSecretVO>> {
  return ucRequest<OAuthClientSecretVO>({
    method: 'POST',
    url: `/oauth2/client/${encodeURIComponent(clientId)}/rotate-secret`,
  })
}

/**
 * 停用 / 启用客户端（POST /oauth2/client/{clientId}/disable | /enable，文档 3.6）
 * 停用后该客户端的授权跳转、换 token、刷新全部拒绝（90001）
 * @param clientId 客户端 ID
 * @param enabled true=启用 false=停用
 */
export function setOAuthClientStatus(clientId: string, enabled: boolean): Promise<UcResponse<null>> {
  return ucRequest<null>({
    method: 'POST',
    url: `/oauth2/client/${encodeURIComponent(clientId)}/${enabled ? 'enable' : 'disable'}`,
  })
}

/**
 * 删除客户端（POST /oauth2/client/{clientId}/delete，文档 3.7）
 * 级联吊销该 client 名下全部 token、未消费的授权码/确认单/票据，删除不可恢复
 * @param clientId 客户端 ID
 */
export function deleteOAuthClient(clientId: string): Promise<UcResponse<null>> {
  return ucRequest<null>({
    method: 'POST',
    url: `/oauth2/client/${encodeURIComponent(clientId)}/delete`,
  })
}
