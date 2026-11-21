import { requestSkland, SklandRequestError, type SklandCredential } from './skland-core'

/**
 * 终末地（Endfield）数据接口
 *
 * 凭证获取、绑定列表解析与上传分别落在 skland-core 与 skland-ef-adapter，
 * 这里负责获取账号级 userId、读取卡片详情及相关类型。
 */

/** 终末地角色 */
export interface EndfieldRole {
  roleId: string
  serverId: string
  nickname: string
  serverName?: string
  level?: number
  /** 绑定项 uid，仅在无法获取账号级 userId 时作为回退值 */
  userId?: string
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

/** 与终末地工具页一致，优先读取账号级 userId，失败时回退到绑定项 uid。 */
async function getEndfieldUserId(credential: SklandCredential, fallback = ''): Promise<string> {
  try {
    const data = await requestSkland<unknown>('/api/v1/user/teenager', '', credential)
    const userId = isRecord(data) && isRecord(data.teenager) ? data.teenager.userId : undefined
    if (typeof userId === 'string' || typeof userId === 'number') {
      const value = String(userId).trim()
      if (value) return value
    }
  } catch {
    // 该辅助接口不可用时仍尝试读取卡片，交由卡片接口报告最终错误。
  }
  return fallback
}

/**
 * 获取终末地角色卡片详情
 *
 * 仅在实际导入终末地时解析账号级 userId，避免未勾选游戏产生额外请求。
 * 绑定项 uid 与账号级 userId 可能不同，不能直接将前者作为首选值。
 * @param credential 森空岛凭证
 * @param role 目标角色
 */
export async function getEndfieldCardDetail(
  credential: SklandCredential,
  role: EndfieldRole,
): Promise<EndfieldCardDetail> {
  const userId = await getEndfieldUserId(credential, role.userId)
  const query = new URLSearchParams({ roleId: role.roleId, serverId: role.serverId })
  if (userId) query.set('userId', userId)

  const data = await requestSkland<{ detail?: EndfieldCardDetail }>(
    '/web/v1/game/endfield/card/detail',
    query.toString(),
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
