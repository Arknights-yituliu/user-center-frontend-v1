import { requestSkland, SklandRequestError, type SklandCredential } from './skland-core'

/**
 * 终末地（Endfield）数据接口
 *
 * 凭证获取、绑定列表解析与上传分别落在 skland-core 与 skland-ef-adapter，
 * 这里只保留「卡片详情」这一个森空岛直连接口与相关类型。
 */

/** 终末地角色 */
export interface EndfieldRole {
  roleId: string
  serverId: string
  nickname: string
  serverName?: string
  level?: number
  /** 森空岛账号标识；官方接口允许省略，为空时不拼接该参数 */
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

/**
 * 获取终末地角色卡片详情
 *
 * `userId`（森空岛账号标识）是官方接口的可选参数，只有拿得到时才拼接，
 * 因此不再为它去请求语义无关的 user/teenager 接口。
 * @param credential 森空岛凭证
 * @param role 目标角色
 */
export async function getEndfieldCardDetail(
  credential: SklandCredential,
  role: EndfieldRole,
): Promise<EndfieldCardDetail> {
  const query = new URLSearchParams({ roleId: role.roleId, serverId: role.serverId })
  if (role.userId) query.set('userId', role.userId)

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
