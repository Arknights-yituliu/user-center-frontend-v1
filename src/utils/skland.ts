import { getOperatorEntry, loadOperatorStaticData, type OperatorStaticData } from './operator-table'
import { requestSkland, type SklandCredential } from '../api/skland-core'
import type { AkOperatorSaveParams, AkSkinSaveItem } from '../api/user-center/ak-account-api'

/**
 * 森空岛（Skland）数据工具类
 *
 * 由 frontend-v2-plus 的 src/utils/survey/skland.js 移植而来，接口签名与数据格式化逻辑保持一致；
 * 签名与请求已统一收敛到 src/api/skland-core.ts，本文件只保留纯解析与转换逻辑。
 * 差异点见各函数注释：
 * 1. 模组分支与星级由 public/data/operator/ 下的干员静态表补全；
 * 2. 参考实现错误上报走 toolAPI.collectLog，本项目暂无对应接口，仅保留消息提示。
 */

export type { SklandCredential }

/** 培养数据（仓库物品 + 干员）接口路径 */
const CULTIVATE_PLAYER_API = '/api/v1/game/cultivate/player'
const PLAYER_INFO_API = '/api/v1/game/player/info'
const PLAYER_DATA_MAX_LENGTH = 2_000_000
const SNAPSHOT_FIELDS = [
  'status', 'medal', 'activity', 'rogue', 'sandbox', 'campaign', 'tower', 'bossRush',
  'building', 'assistChars', 'recruit', 'routine',
] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** 后端按全量集合对齐。遇到无法识别的记录时跳过整组，避免误删已有皮肤。 */
function normalizeSkins(raw: unknown): AkSkinSaveItem[] | undefined {
  if (!Array.isArray(raw) && !isRecord(raw)) return
  const skins = new Map<string, AkSkinSaveItem>()
  for (const [key, entry] of Object.entries(raw)) {
    if (!isRecord(entry)) return
    const id = entry.id ?? entry.skinId ?? (Array.isArray(raw) ? undefined : key)
    const skinId = typeof id === 'string' ? id.trim() : ''
    if (!/^[\x21-\x7e]{1,128}$/.test(skinId)) return
    if (skins.has(skinId)) continue
    const ts = entry.ts ?? entry.gainTs
    const seconds = typeof ts === 'number' || typeof ts === 'string' ? Math.floor(Number(ts)) : 0
    const gainTs = seconds > 0 && seconds <= 2_147_483_647 ? seconds : 0
    skins.set(skinId, { skinId, gainTs })
  }
  if (skins.size) return Array.from(skins.values())
}

function serializePlayerSnapshot(data: Record<string, unknown>): string | undefined {
  const snapshot: Record<string, unknown> = {}
  for (const field of SNAPSHOT_FIELDS) {
    if (data[field] != null) snapshot[field] = data[field]
  }
  if (!Object.keys(snapshot).length) return
  if (data.currentTs != null) snapshot.currentTs = data.currentTs
  try {
    const json = JSON.stringify(snapshot)
    return json.length <= PLAYER_DATA_MAX_LENGTH ? json : undefined
  } catch {
    // 嵌套过深的快照可能无法序列化，皮肤仍可独立同步。
    return undefined
  }
}

/** 复用同一次详情响应构造保存接口的两个可选字段。 */
export async function getPlayerDetails(
  akUid: string,
  credential: SklandCredential,
): Promise<Pick<AkOperatorSaveParams, 'skins' | 'playerData'>> {
  const params = new URLSearchParams({ uid: akUid }).toString()
  const data = await requestSkland<unknown>(PLAYER_INFO_API, params, credential)
  if (!isRecord(data)) return {}
  const skins = normalizeSkins(data.skins)
  const playerData = serializePlayerSnapshot(data)
  return { ...(skins && { skins }), ...(playerData && { playerData }) }
}

/** 仓库物品项 */
export interface SklandWarehouseItem {
  itemId: string
  quantity: number
}

/** 干员上传格式的干员记录 */
export interface SklandOperatorRecord {
  /** 干员 id，如 char_002_amiya */
  id: string
  /** 星级 */
  rarity: number
  /** 等级 */
  level: number
  /** 精英化阶段 */
  evolvePhase: number
  /** 主技能等级 */
  mainSkillLevel: number
  skill1: number
  skill2: number
  skill3: number
  /** X 模组等级 */
  equipX: number
  /** Y 模组等级 */
  equipY: number
  /** D 模组等级 */
  equipD: number
  /** A 模组等级 */
  equipA: number
  /** B 模组等级 */
  equipB: number
  /** 潜能（森空岛原值，0 起算） */
  potentialRank: number
}

/** 培养数据结果 */
export interface SklandWarehouseResult {
  /** 账号信息 */
  playerInfo: { akUid: string }
  /** 干员列表（可直接用于干员上传接口） */
  operators: SklandOperatorRecord[]
  /** 仓库物品列表 */
  itemList: SklandWarehouseItem[]
}

/** 森空岛培养接口返回的干员原始数据 */
interface SklandCultivateCharacter {
  id: string
  level?: number
  evolvePhase?: number
  mainSkillLevel?: number
  potentialRank?: number
  rarity?: number
  skills?: Array<{ level?: number } | null>
  equips?: Array<{ id?: string; level?: number; typeName2?: string } | null>
}

/** 培养接口响应体 */
interface SklandCultivatePayload {
  items?: Array<{ id: string; count: number }>
  characters?: SklandCultivateCharacter[]
}

/** 模组分支名到记录字段的映射 */
type SklandModuleField = 'equipX' | 'equipY' | 'equipD' | 'equipA' | 'equipB'

/**
 * 把森空岛培养接口返回的干员原始数据格式化成干员上传格式
 * 森空岛 equips 通常只有 id 和 level，需要查静态表将模组 id 映射到 X/Y/D/A/B。
 * @param characterList 森空岛培养接口的 characters 字段
 * @param staticData 干员静态数据，提供模组分支与星级
 * @returns 可直接提交给干员上传接口的干员记录列表
 */
export function formattingOperatorData(
  characterList: SklandCultivateCharacter[],
  staticData: OperatorStaticData,
): SklandOperatorRecord[] {
  const operatorList: SklandOperatorRecord[] = []

  const moduleKeyMap: Record<string, SklandModuleField> = {
    X: 'equipX',
    Y: 'equipY',
    D: 'equipD',
    A: 'equipA',
    B: 'equipB',
  }

  for (const character of characterList) {
    const { id, level, evolvePhase, mainSkillLevel, skills, equips, potentialRank, rarity } =
      character
    if (!id) continue
    const entry = getOperatorEntry(staticData, id)

    // 字段名与取值均与干员上传接口对齐，潜能沿用森空岛原值（0 起算）
    const operator: SklandOperatorRecord = {
      id,
      rarity: rarity ?? entry?.rarity ?? 1,
      level: level ?? 0,
      evolvePhase: evolvePhase ?? 0,
      mainSkillLevel: mainSkillLevel ?? 0,
      skill1: 0,
      skill2: 0,
      skill3: 0,
      equipX: 0,
      equipY: 0,
      equipD: 0,
      equipA: 0,
      equipB: 0,
      potentialRank: potentialRank ?? 0,
    }

    // 技能等级：参考实现按 skill1~skill3 顺序写入，最多三名技能
    if (skills) {
      for (let index = 0; index < skills.length && index < 3; index += 1) {
        const skill = skills[index]
        if (!skill || typeof skill.level !== 'number') continue
        if (index === 0) operator.skill1 = skill.level
        else if (index === 1) operator.skill2 = skill.level
        else operator.skill3 = skill.level
      }
    }

    // 模组等级：按分支名写入对应的 equipX/equipY/equipD/equipA/equipB
    if (equips) {
      for (const equip of equips) {
        if (!equip || typeof equip.level !== 'number') continue
        const branch =
          entry?.equip?.find((item) => item.uniEquipId === equip.id)?.typeName2 ?? equip.typeName2
        const field = branch ? moduleKeyMap[branch.toUpperCase()] : undefined
        if (field) {
          operator[field] = equip.level
        } else if (equip.level > 0) {
          // 无法映射已升级模组时中止导入，避免把已有模组等级静默覆盖成 0。
          throw new Error('部分已升级模组无法匹配静态数据，请刷新页面后重试导入')
        }
      }
    }

    operatorList.push(operator)
  }

  return operatorList
}

/**
 * 获取账号的仓库物品与干员数据
 * @param akUid 明日方舟账号 uid
 * @param cred 森空岛 cred
 * @param token 森空岛 token
 * @returns 账号信息、干员列表（上传格式）与仓库物品列表
 */
export async function getWarehouseInfo(
  akUid: string,
  cred: string,
  token: string,
): Promise<SklandWarehouseResult> {
  const params = new URLSearchParams({ uid: akUid }).toString()
  const [payload, staticData] = await Promise.all([
    requestSkland<SklandCultivatePayload>(CULTIVATE_PLAYER_API, params, { cred, token }),
    loadOperatorStaticData(),
  ])

  const items = payload?.items ?? []
  const characters = payload?.characters ?? []

  return {
    playerInfo: { akUid },
    operators: formattingOperatorData(characters, staticData),
    itemList: items.map((item) => ({ itemId: item.id, quantity: item.count })),
  }
}
