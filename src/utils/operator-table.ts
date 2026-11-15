/**
 * 干员静态表：名称、星级、职业等展示信息
 *
 * 数据来源 `public/data/operator/`（同步自 frontend-v2-plus 的 arknights 静态表）：
 * - `character_table_simple.v2.json`：charId → { name, rarity, profession, subProfessionId }
 * - `profession_dict.json`：职业 / 分支的英文标识与中文名
 * - `operator_update_time.json`：干员实装时间
 *
 * 放在 public 下按需 fetch 而不打进 JS 包：整表约 670KB，只有游戏数据页需要，
 * 也避免大 JSON 参与 TS 类型推导。
 */

/** 技能条目（静态表 `skills` 数组） */
export interface OperatorSkillInfo {
  /** 技能 id，如 skchr_angel_1 */
  skillId: string
  /** 技能名 */
  skillName: string
  /** 技能图标 id，如 skchr_angel_1（含 x5b / x5d 转义） */
  skillIcon: string
}

/** 模组条目（静态表 `equip` 数组） */
export interface OperatorEquipInfo {
  /** 模组唯一 id，如 uniequip_002_angel */
  uniEquipId: string
  /** 模组图标 id，如 mar-x（去掉 .png 即为文件名） */
  typeIcon: string
  /** 模组类型前缀，如 MAR */
  typeName1: string
  /** 模组槽位：X / Y / D / A / B */
  typeName2: string
  /** 模组名 */
  uniEquipName?: string
}

/** 单个干员的静态信息 */
export interface OperatorTableEntry {
  /** 干员显示名 */
  name: string
  /** 干员编码，如 char_002_amiya */
  charId: string
  /** 星级（1~6） */
  rarity: number
  /** 职业标识，如 SNIPER */
  profession: string
  /** 分支标识，如 fastshot */
  subProfessionId: string
  /** 实装年份，由 operator_update_time.json 补充 */
  releaseYear?: number
  /** 技能列表（顺序与 skill1/2/3 对应） */
  skills?: OperatorSkillInfo[]
  /** 模组列表（按 typeName2 区分槽位） */
  equip?: OperatorEquipInfo[]
}

/** charId → 干员静态信息 */
export type OperatorTable = Record<string, OperatorTableEntry>

/** 干员静态数据（含职业中文名映射） */
export interface OperatorStaticData {
  operators: OperatorTable
  professionLabels: Record<string, string>
  subProfessionLabels: Record<string, string>
}

/** 静态数据未加载 / 加载失败时的空表，便于视图侧直接使用 */
export const EMPTY_OPERATOR_STATIC_DATA: OperatorStaticData = {
  operators: {},
  professionLabels: {},
  subProfessionLabels: {},
}

/** profession_dict.json 的条目结构 */
interface ProfessionDictItem {
  value: string
  label: string
  children?: Array<{ value: string; label: string }>
}

interface OperatorReleaseInfo {
  updateTime?: string
}

const DATA_BASE = `${import.meta.env.BASE_URL}data/operator/`

/**
 * 读取 public 下的 JSON，失败时返回 null（不阻断页面主流程）
 * @param file 相对 data/operator/ 的文件名
 */
async function fetchJson<T>(file: string): Promise<T | null> {
  try {
    const response = await fetch(`${DATA_BASE}${file}`)
    if (!response.ok) return null
    return (await response.json()) as T
  } catch {
    return null
  }
}

let loadingPromise: Promise<OperatorStaticData> | null = null

/**
 * 加载干员静态表、实装时间与职业字典（进程内只请求一次）
 * 失败时返回空表，调用方按「没有名称」降级展示
 */
export function loadOperatorStaticData(): Promise<OperatorStaticData> {
  if (loadingPromise) return loadingPromise
  loadingPromise = Promise.all([
    fetchJson<OperatorTable>('character_table_simple.v2.json'),
    fetchJson<ProfessionDictItem[]>('profession_dict.json'),
    fetchJson<Record<string, OperatorReleaseInfo>>('operator_update_time.json'),
  ]).then(([operators, professions, releaseInfo]) => {
    for (const [id, entry] of Object.entries(operators || {})) {
      const year = Number(releaseInfo?.[id]?.updateTime?.match(/^(\d{4})\//)?.[1])
      if (Number.isInteger(year)) entry.releaseYear = year
    }
    const professionLabels: Record<string, string> = {}
    const subProfessionLabels: Record<string, string> = {}
    for (const item of professions || []) {
      professionLabels[item.value] = item.label
      for (const child of item.children || []) {
        subProfessionLabels[child.value] = child.label
      }
    }
    return { operators: operators || {}, professionLabels, subProfessionLabels }
  })
  return loadingPromise
}

/**
 * 取干员静态信息
 * @param data 已加载的静态数据
 * @param charId 干员编码
 */
export function getOperatorEntry(
  data: OperatorStaticData,
  charId: string,
): OperatorTableEntry | undefined {
  if (!charId) return undefined
  return data.operators[charId]
}

/**
 * 干员显示名：静态表缺失时回退到 charId
 * @param data 已加载的静态数据
 * @param charId 干员编码
 */
export function getOperatorDisplayName(data: OperatorStaticData, charId: string): string {
  return getOperatorEntry(data, charId)?.name || charId
}

/**
 * 职业与分支文案，如「狙击 · 速射手」；缺一项时只显示已有的
 * @param data 已加载的静态数据
 * @param charId 干员编码
 */
export function getOperatorProfessionText(data: OperatorStaticData, charId: string): string {
  const entry = getOperatorEntry(data, charId)
  if (!entry) return ''
  const profession = data.professionLabels[entry.profession] || entry.profession
  const subProfession = data.subProfessionLabels[entry.subProfessionId] || entry.subProfessionId
  return [profession, subProfession].filter(Boolean).join(' · ')
}

/**
 * 第 index 个技能（从 0 开始）的图标 id，用于 getSkillIconUrl
 * @param data 已加载的静态数据
 * @param charId 干员编码
 * @param index 技能下标（0/1/2 对应一/二/三技能）
 * @returns 图标 id，没有该技能时返回空串
 */
export function getOperatorSkillIconId(
  data: OperatorStaticData,
  charId: string,
  index: number,
): string {
  const skills = getOperatorEntry(data, charId)?.skills
  if (!skills || index < 0 || index >= skills.length) return ''
  return skills[index]?.skillIcon || ''
}

/**
 * 第 index 个技能的名称
 * @param data 已加载的静态数据
 * @param charId 干员编码
 * @param index 技能下标（0/1/2 对应一/二/三技能）
 * @returns 技能名，没有该技能时返回空串
 */
export function getOperatorSkillName(
  data: OperatorStaticData,
  charId: string,
  index: number,
): string {
  const skills = getOperatorEntry(data, charId)?.skills
  if (!skills || index < 0 || index >= skills.length) return ''
  return skills[index]?.skillName || ''
}

/**
 * 指定槽位模组的名称
 * @param data 已加载的静态数据
 * @param charId 干员编码
 * @param slot 模组槽位字母
 * @returns 模组名，没有该槽位时返回空串
 */
export function getOperatorEquipName(
  data: OperatorStaticData,
  charId: string,
  slot: string,
): string {
  const equipList = getOperatorEntry(data, charId)?.equip
  if (!equipList) return ''
  return equipList.find((equip) => equip.typeName2 === slot)?.uniEquipName || ''
}

/**
 * 指定槽位（X / Y / D / A / B）的模组图标 id，用于 getEquipIconUrl
 * @param data 已加载的静态数据
 * @param charId 干员编码
 * @param slot 模组槽位字母
 * @returns 图标 id，该干员没有此槽位模组时返回空串
 */
export function getOperatorEquipIconId(
  data: OperatorStaticData,
  charId: string,
  slot: string,
): string {
  const equipList = getOperatorEntry(data, charId)?.equip
  if (!equipList) return ''
  return equipList.find((equip) => equip.typeName2 === slot)?.typeIcon || ''
}
