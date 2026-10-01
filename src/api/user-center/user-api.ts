/**
 * UC 业务接口封装（登录、注册、资料、邮箱、OAuth 授权）
 *
 * 会话存取与统一请求封装（ucRequest）见 ./request，本文件只保留业务接口。
 */
import { clearUcSession, ucRequest, type UcResponse } from './request'

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

/** 密码登录参数（accountType=password，邮箱与用户名二选一） */
export interface UcLoginByPasswordParams {
  accountType: 'password'
  /** 账号为邮箱时传 email，为用户名时传 userName */
  email?: string
  userName?: string
  password: string
}

/** 邮箱验证码登录参数（accountType=email，免密登录） */
export interface UcLoginByEmailParams {
  accountType: 'email'
  email: string
  verificationCode: string
}

/** 登录参数（POST /auth/login） */
export type UcLoginParams = UcLoginByPasswordParams | UcLoginByEmailParams

/** 注册参数（POST /auth/register，仅账号密码方式） */
export interface UcRegisterParams {
  registerType: 'password'
  userName: string
  email: string
  verificationCode: string
  password: string
  nickname?: string
}

/** OAuth 一次性票据（POST /oauth2/ticket） */
export interface UcTicketVO {
  ticket: string
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
 * 登录（UC POST /auth/login，无需登录态）
 * 密码登录传 email 或 userName；邮箱登录传 email + verificationCode
 * @param params 登录参数
 * @returns 登录会话（token + uid）
 */
export function login(params: UcLoginParams): Promise<UcResponse<UcSessionVO>> {
  return ucRequest<UcSessionVO>({
    method: 'POST',
    url: '/auth/login',
    data: params,
    auth: false,
  })
}

/**
 * 注册（UC POST /auth/register，无需登录态，注册即自动登录）
 * @param params 注册参数
 * @returns 登录会话（token + uid）
 */
export function register(params: UcRegisterParams): Promise<UcResponse<UcSessionVO>> {
  return ucRequest<UcSessionVO>({
    method: 'POST',
    url: '/auth/register',
    data: params,
    auth: false,
  })
}

/**
 * 换取 OAuth 一次性票据（UC POST /oauth2/ticket）
 * 用于 OAuth 授权回跳流程：携带 uc_ticket 回跳 authorize 继续授权
 * @param token 指定会话 token（OAuth 安全登录/注册页的本次内存 token），不传则用本地会话
 */
export function getOAuthTicket(token = ''): Promise<UcResponse<UcTicketVO>> {
  return ucRequest<UcTicketVO>({ method: 'POST', url: '/oauth2/ticket', token })
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

/** OAuth 授权确认单权限条目（GET /oauth2/consent/info） */
export interface ConsentScopeItem {
  /** 权限标识（如 user.read） */
  code: string
  /** 权限中文描述 */
  desc: string
}

/** OAuth 授权确认单信息（GET /oauth2/consent/info） */
export interface ConsentInfoVO {
  /** 发起授权的用户 uid */
  uid: number
  /** 客户端 ID */
  clientId: string
  /** 客户端名称（第三方网站名） */
  clientName: string
  /** 授权回调地址 */
  redirectUri: string
  /** 本次申请的权限列表 */
  scopes: ConsentScopeItem[]
  /** 当前已授予该应用的权限（来自用户自定义授权范围；从未自定义过则为空数组） */
  grantedScopes: ConsentScopeItem[]
  /** 该应用登记的全部可选权限（用户可在此范围内追加） */
  selectableScopes: ConsentScopeItem[]
}

/**
 * 查询 OAuth 授权确认信息（UC GET /oauth2/consent/info，需登录）
 * 确认页加载时调用：校验登录态并返回客户端名称与申请权限
 * @param pendingId 授权确认单 ID（authorize 302 携带）
 */
export function getConsentInfo(pendingId: string): Promise<UcResponse<ConsentInfoVO>> {
  return ucRequest<ConsentInfoVO>({
    method: 'GET',
    url: `/oauth2/consent/info?pending_id=${encodeURIComponent(pendingId)}`,
  })
}

/**
 * 确认/拒绝 OAuth 授权（UC POST /oauth2/consent，需登录，确认单一次性消费）
 * 同意则返回带授权码的回跳地址，拒绝则返回 error=access_denied 回跳地址
 * @param pendingId 授权确认单 ID
 * @param approve 是否同意授权
 * @param scopes 用户最终选定的权限标识集合；不传表示沿用申请范围（追加/取消均由该参数承载）
 */
export function confirmConsent(
  pendingId: string,
  approve: boolean,
  scopes?: string[],
): Promise<UcResponse<string>> {
  return ucRequest<string>({
    method: 'POST',
    url: '/oauth2/consent',
    data: scopes ? { pending_id: pendingId, approve, scopes } : { pending_id: pendingId, approve },
  })
}
