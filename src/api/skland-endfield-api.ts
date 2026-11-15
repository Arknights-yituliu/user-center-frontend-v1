import axios from 'axios'
import { ucRequest } from './user-center/request'
import {
  parseSklandCredential,
  requestSkland,
  SklandRequestError,
  type SklandCredential,
  type SklandQrCode,
  type SklandQrStatus,
} from './skland-operator-api'

export interface EndfieldRole {
  roleId: string
  serverId: string
  nickname: string
  serverName?: string
  level?: number
  userId: string
}

export interface EndfieldCharacter {
  charData?: { id?: string; name?: string; charName?: string; rarity?: { key?: string } }
  level?: number
  evolvePhase?: number
  potentialLevel?: number
  weapon?: {
    level?: number
    refineLevel?: number
    weaponData?: { id?: string; name?: string; weaponName?: string }
  }
  [key: string]: unknown
}

/** 保留完整原始字段，上传时不裁剪干员、装备、地区等数据。 */
export interface EndfieldCardDetail extends Record<string, unknown> {
  base?: {
    roleId?: string
    name?: string
    level?: number
    worldLevel?: number
    avatarUrl?: string
    charNum?: number
    weaponNum?: number
    mainMission?: { description?: string }
  }
  chars?: EndfieldCharacter[]
  domain?: Array<{ name?: string; level?: number }>
  dungeon?: { curStamina?: number; maxStamina?: number }
  dailyMission?: { dailyActivation?: number; maxDailyActivation?: number }
  weeklyMission?: { score?: number; total?: number }
  bpSystem?: { curLevel?: number; maxLevel?: number }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function identifier(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : ''
}

function readCredential(value: unknown): SklandCredential {
  if (!isRecord(value) || !identifier(value.cred) || !identifier(value.token)) {
    throw new SklandRequestError('未获取到有效的森空岛凭证')
  }
  return { cred: identifier(value.cred), token: identifier(value.token) }
}

export function isEndfieldCredentialExpired(error: unknown): boolean {
  return error instanceof SklandRequestError && (error.code === 10000 || error.code === 10002)
}

/** 支持直接输入 cred，或已有的 cred,token 凭证对。 */
export async function getEndfieldCredential(input: string): Promise<SklandCredential> {
  const value = input.trim()
  if (value.includes(',')) return parseSklandCredential(value)
  if (!value) throw new SklandRequestError('请输入森空岛 cred 或 cred,token')
  const response = await axios.get('https://zonai.skland.com/api/v1/auth/refresh', {
    headers: { cred: value },
    timeout: 15000,
  })
  const payload: unknown = response.data
  if (!isRecord(payload) || payload.code !== 0 || !isRecord(payload.data)) {
    throw new SklandRequestError(
      isRecord(payload) && typeof payload.message === 'string'
        ? payload.message
        : 'cred 无效或已过期',
      response.status,
      isRecord(payload) && typeof payload.code === 'number' ? payload.code : undefined,
    )
  }
  return readCredential({ cred: value, token: payload.data.token })
}

export async function getEndfieldCredentialByOfficialToken(
  token: string,
): Promise<SklandCredential> {
  const response = await ucRequest<unknown>({
    method: 'POST',
    url: '/skland/hg/cred-token',
    data: { token },
    auth: false,
  })
  return readCredential(response.data)
}

export async function createEndfieldQrCode(): Promise<SklandQrCode> {
  const response = await ucRequest<SklandQrCode>({
    method: 'POST',
    url: '/skland/qr/create',
    auth: false,
  })
  if (!response.data?.scanId || !response.data.qrContent) {
    throw new SklandRequestError('二维码信息不完整，请重试')
  }
  return response.data
}

export async function checkEndfieldQrStatus(scanId: string): Promise<SklandQrStatus> {
  const response = await ucRequest<SklandQrStatus>({
    method: 'POST',
    url: `/skland/qr/check?scanId=${encodeURIComponent(scanId)}`,
    auth: false,
  })
  if (typeof response.data?.status !== 'number') {
    throw new SklandRequestError('二维码状态返回格式不正确')
  }
  return response.data
}

export async function getEndfieldRoles(credential: SklandCredential): Promise<EndfieldRole[]> {
  const binding = await requestSkland<{ list?: unknown[] }>(
    '/api/v1/game/player/binding',
    '',
    credential,
  )
  const group = Array.isArray(binding?.list)
    ? binding.list.find((item) => isRecord(item) && item.appCode === 'endfield')
    : undefined
  const entries = isRecord(group) && Array.isArray(group.bindingList) ? group.bindingList : []
  if (!entries.length) return []

  let userId = ''
  try {
    const data = await requestSkland<{ teenager?: { userId?: string | number } }>(
      '/api/v1/user/teenager',
      '',
      credential,
    )
    userId = identifier(data?.teenager?.userId)
  } catch (error) {
    if (isEndfieldCredentialExpired(error)) throw error
    // teenager 不可用时，按每个绑定账号自己的 uid 回退。
  }

  const roles = entries.flatMap((entry): EndfieldRole[] => {
    if (!isRecord(entry) || entry.isDelete === true || !Array.isArray(entry.roles)) return []
    return entry.roles.flatMap((role) => {
      if (!isRecord(role)) return []
      const roleId = identifier(role.roleId)
      const serverId = identifier(role.serverId)
      if (!roleId || !serverId) return []
      return [
        {
          roleId,
          serverId,
          userId: userId || identifier(entry.uid),
          nickname: typeof role.nickname === 'string' ? role.nickname : roleId,
          serverName: typeof role.serverName === 'string' ? role.serverName : serverId,
          level: typeof role.level === 'number' ? role.level : undefined,
        },
      ]
    })
  })
  return roles.filter(
    (role, index) =>
      roles.findIndex(
        (other) => other.roleId === role.roleId && other.serverId === role.serverId,
      ) === index,
  )
}

export async function getEndfieldCardDetail(
  credential: SklandCredential,
  role: EndfieldRole,
): Promise<EndfieldCardDetail> {
  if (!role.userId) throw new SklandRequestError('未获取到账号标识，请重新读取森空岛账号')
  const query = new URLSearchParams({
    roleId: role.roleId,
    serverId: role.serverId,
    userId: role.userId,
  }).toString()
  const data = await requestSkland<{ detail?: EndfieldCardDetail }>(
    '/web/v1/game/endfield/card/detail',
    query,
    credential,
  )
  if (!isRecord(data?.detail) || !Object.keys(data.detail).length) {
    throw new SklandRequestError('森空岛未返回角色数据，请稍后重试')
  }
  if (data.detail.base?.roleId && String(data.detail.base.roleId) !== role.roleId) {
    throw new SklandRequestError('返回的角色与所选账号不一致，请重新读取')
  }
  return data.detail
}
