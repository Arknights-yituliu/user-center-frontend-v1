import {
  toSklandImportError,
  type SklandBindingPayload,
  type SklandCredential,
} from './skland-core'
import { saveAkOperators } from './user-center/ak-account-api'
import { getPlayerDetails, getWarehouseInfo } from '../utils/skland'
import {
  targetKey,
  type AkTarget,
  type ImportOutcome,
  type SklandImportError,
} from '../types/skland-import'

/**
 * 明日方舟适配层：绑定列表解析 / 数据拉取 / 上传
 *
 * 只负责本游戏的字段形状（扁平 uid），不与其他游戏强行统一数据模型；
 * 失败统一抛 SklandImportError（含阶段），由页面汇总到底部错误区。
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * 从一次 binding 响应中解析明日方舟账号（不做默认兜底）
 * @param payload player/binding 的 data
 * @returns 明舟账号列表，无绑定时为空数组
 */
export function parseAkTargets(payload: SklandBindingPayload): AkTarget[] {
  const applications = Array.isArray(payload?.list) ? payload.list : []
  const group = applications.find((item) => isRecord(item) && item.appCode === 'arknights')
  const entries =
    isRecord(group) && Array.isArray(group.bindingList) ? (group.bindingList as unknown[]) : []

  return entries.flatMap((entry) => {
    if (!isRecord(entry)) return []
    const uid =
      typeof entry.uid === 'string'
        ? entry.uid.trim()
        : typeof entry.uid === 'number'
          ? String(entry.uid)
          : ''
    if (!uid) return []

    const channelName = text(entry.channelName)
    return [
      {
        game: 'arknights' as const,
        key: targetKey('arknights', [uid]),
        akUid: uid,
        nickname: text(entry.nickName),
        serverName: channelName,
        channelMasterId:
          typeof entry.channelMasterId === 'number'
            ? String(entry.channelMasterId)
            : text(entry.channelMasterId),
        // 森空岛没有独立的默认标记，用「官服」作为唯一可识别的默认来源
        isDefault: entry.isOfficial === true,
      },
    ]
  })
}

/**
 * 拉取并上传明日方舟干员数据
 * @param target 选中的账号
 * @param credential 森空岛凭证
 * @returns 导入结果摘要
 */
export async function importAkData(
  target: AkTarget,
  credential: SklandCredential,
): Promise<ImportOutcome> {
  const [warehouse, details] = await Promise.all([
    getWarehouseInfo(target.akUid, credential.cred, credential.token).catch((error: unknown) => {
      throw toSklandImportError(error, 'arknights', 'fetch', '森空岛干员数据读取失败')
    }),
    getPlayerDetails(target.akUid, credential).catch(() => undefined),
  ])

  if (!warehouse.operators.length) {
    const empty: SklandImportError = {
      game: 'arknights',
      stage: 'fetch',
      message: '森空岛没有返回可识别的干员记录',
    }
    throw empty
  }

  try {
    const saved = await saveAkOperators({
      playerInfo: {
        ...warehouse.playerInfo,
        channelName: target.serverName,
        channelMasterId: target.channelMasterId,
        nickName: target.nickname,
      },
      operators: warehouse.operators,
      ...details,
    })
    const { createdCount, updatedCount, unchangedCount } = saved.data
    const skipped = []
    if (!details?.skins) skipped.push('皮肤')
    if (!details?.playerData) skipped.push('角色快照')
    const note = skipped.length ? `。本次跳过${skipped.join('和')}` : '，已同步皮肤和角色快照'
    return {
      game: 'arknights',
      ok: true,
      summary: `已上传 ${warehouse.operators.length} 名干员（新增 ${createdCount}、更新 ${updatedCount}、未变化 ${unchangedCount}）${note}`,
    }
  } catch (error) {
    throw toSklandImportError(error, 'arknights', 'upload', '干员数据上传失败')
  }
}
