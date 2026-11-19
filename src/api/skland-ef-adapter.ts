import {
  toSklandImportError,
  type SklandBindingPayload,
  type SklandCredential,
} from './skland-core'
import { getEndfieldCardDetail } from './skland-endfield-api'
import { saveEfPlayerData } from './user-center/ef-account-api'
import { targetKey, type EfTarget, type ImportOutcome } from '../types/skland-import'

/**
 * 终末地适配层：绑定列表解析 / 数据拉取 / 上传
 *
 * 终末地是 roleId + serverId（+ 可选 userId）的账号粒度，绑定项里 role 又是嵌套结构，
 * 因此这里独立展开 / 过滤 / 去重，不与其他游戏共用数据模型。
 *
 * 此处保留绑定项 uid 作为回退值，卡片请求前由 skland-endfield-api
 * 优先从 user/teenager 解析账号级 userId。
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function identifier(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : ''
}

function readEfGroup(payload: SklandBindingPayload): Record<string, unknown> | undefined {
  const applications = Array.isArray(payload?.list) ? payload.list : []
  const group = applications.find((item) => isRecord(item) && item.appCode === 'endfield')
  return isRecord(group) ? group : undefined
}

/**
 * 解析终末地角色列表
 *
 * 直接消费已获取的 binding 响应，不发起任何网络请求：
 * 过滤已删除的绑定项、丢弃缺 roleId/serverId 的角色、按 (serverId, roleId) 去重。
 * @param payload 已获取的 binding 数据
 * @returns 去重后的角色列表
 */
export function parseEfTargets(payload: SklandBindingPayload): EfTarget[] {
  const group = readEfGroup(payload)
  const entries = group && Array.isArray(group.bindingList) ? (group.bindingList as unknown[]) : []
  if (!entries.length) return []

  const defaultUid = identifier(group?.defaultUid)

  const targets = entries.flatMap((entry): EfTarget[] => {
    if (!isRecord(entry) || entry.isDelete === true || !Array.isArray(entry.roles)) return []
    const entryDefault = entry.isDefault === true
    const entryUid = identifier(entry.uid)
    return entry.roles.flatMap((role) => {
      if (!isRecord(role)) return []
      const roleId = identifier(role.roleId)
      const serverId = identifier(role.serverId)
      if (!roleId || !serverId) return []
      return [
        {
          game: 'endfield' as const,
          key: targetKey('endfield', [serverId, roleId]),
          roleId,
          serverId,
          userId: entryUid,
          nickname: typeof role.nickname === 'string' && role.nickname ? role.nickname : roleId,
          serverName:
            typeof role.serverName === 'string' && role.serverName ? role.serverName : serverId,
          isDefault:
            role.isDefault === true || entryDefault || (!!defaultUid && defaultUid === roleId),
        },
      ]
    })
  })

  return targets.filter(
    (target, index) => targets.findIndex((other) => other.key === target.key) === index,
  )
}

/**
 * 拉取并上传终末地玩家数据
 * @param target 选中的角色
 * @param credential 森空岛凭证
 * @returns 导入结果摘要
 */
export async function importEfData(
  target: EfTarget,
  credential: SklandCredential,
): Promise<ImportOutcome> {
  let detail
  try {
    detail = await getEndfieldCardDetail(credential, {
      roleId: target.roleId,
      serverId: target.serverId,
      userId: target.userId,
      nickname: target.nickname,
      serverName: target.serverName,
    })
  } catch (error) {
    throw toSklandImportError(error, 'endfield', 'fetch', '森空岛终末地数据读取失败')
  }

  try {
    await saveEfPlayerData({
      roleId: target.roleId,
      serverId: target.serverId,
      playerData: detail,
    })
    return {
      game: 'endfield',
      ok: true,
      summary: `已导入 ${target.nickname} 的终末地数据`,
    }
  } catch (error) {
    throw toSklandImportError(error, 'endfield', 'upload', '终末地数据上传失败')
  }
}
