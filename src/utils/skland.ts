import axios from 'axios'
import hmacSHA256 from 'crypto-js/hmac-sha256'
import md5 from 'crypto-js/md5'
import { createMessage } from './message'

/**
 * 森空岛（Skland）数据工具类
 *
 * 由 frontend-v2-plus 的 src/utils/survey/skland.js 移植而来，接口签名、请求与数据格式化逻辑保持一致；
 * 差异点见各函数注释：
 * 1. 参考实现依赖本地干员表 operatorTableV2 构建模组字典、校验星级，本项目没有该数据表，
 *    改为直接使用森空岛接口下发的 typeName2 与 rarity；
 * 2. 参考实现错误上报走 toolAPI.collectLog，本项目暂无对应接口，仅保留消息提示。
 */

/** 森空岛主域名 */
const SKLAND_DOMAIN = 'https://zonai.skland.com'
/** 玩家绑定关系接口路径 */
const PLAYER_BINDING_URL = '/api/v1/game/player/binding'
/** 培养数据（仓库物品 + 干员）接口路径 */
const CULTIVATE_PLAYER_API = '/api/v1/game/cultivate/player'
/** 签名使用的固定平台标识 */
const SKLAND_PLATFORM = '3'
/** 签名使用的固定设备标识 */
const SKLAND_DEVICE_ID =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/118.0'
/** 签名使用的接口版本号 */
const SKLAND_VERSION = '1.2.0'

/** 森空岛凭证 */
export interface SklandCredential {
  /** 账号凭证 */
  cred: string
  /** 签名密钥 */
  token: string
}

/** 单个绑定账号 */
export interface SklandBinding {
  uid: string
  nickName: string
  channelName: string
  channelMasterId: number
  isOfficial?: boolean
}

/** 绑定查询结果（与参考实现 getPlayBindingV2 的返回结构保持一致） */
export interface SklandBindingResult {
  /** 明日方舟的全部绑定账号 */
  bindingList: SklandBinding[]
  /** 选中的账号 uid */
  uid: string
  /** 选中的账号昵称 */
  nickName: string
  /** 选中的账号渠道名 */
  channelName: string
  /** 选中的账号渠道 id */
  channelMasterId: number
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

/** 森空岛接口通用响应包裹 */
interface SklandApiResponse<T> {
  code?: number
  message?: string
  data?: T
}

/** 绑定接口响应体 */
interface SklandBindingPayload {
  list?: Array<{ appCode?: string; bindingList?: SklandBinding[] }>
}

/** 培养接口响应体 */
interface SklandCultivatePayload {
  items?: Array<{ id: string; count: number }>
  characters?: SklandCultivateCharacter[]
}

/** 模组分支名到记录字段的映射 */
type SklandModuleField = 'equipX' | 'equipY' | 'equipD' | 'equipA' | 'equipB'

/**
 * 生成森空岛接口签名
 * @param path 接口路径，如 /api/v1/game/player/binding
 * @param params 查询串，如 uid=123，可传空串
 * @param token 森空岛 token，作为 HMAC 密钥
 * @returns 参与签名的 timestamp 与最终 sign
 */
function getSign(path: string, params: string, token: string): { timestamp: string; sign: string } {
  // 预留 300ms 时钟偏差，避免服务端判定请求过期
  const timestamp = Math.floor((Date.now() - 300) / 1000).toString()

  const headers = {
    platform: SKLAND_PLATFORM,
    timestamp,
    dId: SKLAND_DEVICE_ID,
    vName: SKLAND_VERSION,
  }

  // 与参考实现一致：先做 HMAC-SHA256，再把摘要做一次 MD5
  const text = path + (params || '') + timestamp + JSON.stringify(headers)
  const sign = md5(hmacSHA256(text, token).toString()).toString()

  return { timestamp, sign }
}

/**
 * 生成森空岛接口请求头（含签名）
 * @param url 接口路径，如 /api/v1/game/player/binding
 * @param params 查询串，如 uid=123，可传空串
 * @param cred 森空岛 cred
 * @param token 森空岛 token
 * @returns 可直接用于 axios 的请求头
 */
export function getHeaders(
  url: string,
  params: string,
  cred: string,
  token: string,
): Record<string, string> {
  const { timestamp, sign } = getSign(url, params, token)

  return {
    platform: SKLAND_PLATFORM,
    timestamp,
    dId: SKLAND_DEVICE_ID,
    vName: SKLAND_VERSION,
    cred,
    sign,
  }
}

/**
 * 解析用户粘贴的凭证文本
 * 参考实现会在格式不正确时弹出错误提示，但依旧按逗号切分返回
 * @param text 形如 `cred,token` 的字符串，允许包含引号与空白
 * @returns 解析出的 cred 与 token
 */
export function getCredAndSecret(text: string): SklandCredential {
  if (!text.includes(',')) {
    createMessage({ type: 'error', text: '输入格式不正确,应是一个中间包含逗号的一串字母' })
  }

  const cleaned = text.replace(/\s+/g, '').replace(/["']/g, '')
  const textArr = cleaned.split(',')

  return { cred: textArr[0] || '', token: textArr[1] || '' }
}

/**
 * 获取玩家绑定账号，并按「指定 uid → 官服账号 → 首个账号」的顺序选出默认账号
 * @param defaultAkUid 期望优先选中的 uid，传 '0' 表示不指定
 * @param params 查询串，绑定接口不使用，保留以对齐参考实现
 * @param cred 森空岛 cred
 * @param token 森空岛 token
 * @returns 绑定列表与选中的账号信息
 */
export async function getPlayBindingV2(
  defaultAkUid: string,
  params: string,
  cred: string,
  token: string,
): Promise<SklandBindingResult> {
  let uid = '0'
  let nickName = ''
  let channelName = '默认'
  let channelMasterId = -1

  const url = `${SKLAND_DOMAIN}${PLAYER_BINDING_URL}`
  const headers = getHeaders(PLAYER_BINDING_URL, params, cred, token)

  const bindingData: SklandBindingResult = {
    bindingList: [],
    uid,
    nickName,
    channelName: '官服',
    channelMasterId: 1,
  }

  try {
    const response = await axios.get(url, { headers })
    const payload = response.data as SklandApiResponse<SklandBindingPayload>

    if (payload.code !== 0) {
      createMessage({ type: 'error', text: '森空岛CRED错误或失效' })
      return bindingData
    }

    const list = payload.data?.list ?? []

    let akBindingList: SklandBinding[] = []
    for (const item of list) {
      if (item.appCode === 'arknights') {
        akBindingList = item.bindingList ?? []
        break
      }
    }

    for (const binding of akBindingList) {
      if (defaultAkUid !== '0' && binding.uid === defaultAkUid) {
        uid = binding.uid
        nickName = binding.nickName
        channelName = binding.channelName
        channelMasterId = binding.channelMasterId
        break
      }

      if (binding.isOfficial) {
        uid = binding.uid
        nickName = binding.nickName
        channelName = binding.channelName
        channelMasterId = binding.channelMasterId
        break
      }
    }

    // 参考实现的兜底判断比较的是 undefined（永远不会命中），此处按其本意修正为：
    // 既没匹配到指定 uid、也没有官服账号时，退回第一个绑定账号
    if (uid === '0' && akBindingList.length > 0) {
      const binding = akBindingList[0]!
      uid = binding.uid
      nickName = binding.nickName
      channelName = binding.channelName
      channelMasterId = binding.channelMasterId
    }

    bindingData.bindingList = akBindingList
    bindingData.uid = uid
    bindingData.nickName = nickName
    bindingData.channelName = channelName
    bindingData.channelMasterId = channelMasterId
  } catch (error) {
    const message = axios.isAxiosError(error)
      ? ((error.response?.data as { message?: string } | undefined)?.message ?? error.message)
      : '未知错误'
    createMessage({ type: 'error', text: `森空岛：${message}` })
    return bindingData
  }

  return bindingData
}

/**
 * 把森空岛培养接口返回的干员原始数据格式化成干员上传格式
 * 参考实现用本地干员表构建「模组 id → 分支名」字典并校验星级，本项目没有该数据表，
 * 改为直接使用接口下发的 equips[].typeName2 与 rarity
 * @param characterList 森空岛培养接口的 characters 字段
 * @returns 可直接提交给干员上传接口的干员记录列表
 */
export function formattingOperatorData(
  characterList: SklandCultivateCharacter[],
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

    // 字段名与取值均与干员上传接口对齐，潜能沿用森空岛原值（0 起算）
    const operator: SklandOperatorRecord = {
      id,
      rarity: rarity ?? 1,
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
        const field = equip.typeName2 ? moduleKeyMap[equip.typeName2.toUpperCase()] : undefined
        if (field) operator[field] = equip.level
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
  const params = `uid=${akUid}`
  const headers = getHeaders(CULTIVATE_PLAYER_API, params, cred, token)
  const url = `${SKLAND_DOMAIN}${CULTIVATE_PLAYER_API}?${params}`

  const data: SklandWarehouseResult = {
    playerInfo: { akUid },
    operators: [],
    itemList: [],
  }

  const response = await axios.get(url, { headers })
  const payload = response.data as SklandApiResponse<SklandCultivatePayload>

  if (payload.code !== 0) {
    return data
  }

  const items = payload.data?.items ?? []
  const characters = payload.data?.characters ?? []

  data.operators = formattingOperatorData(characters)
  data.itemList = items.map((item) => ({ itemId: item.id, quantity: item.count }))

  return data
}

export default {
  getPlayBindingV2,
  getWarehouseInfo,
}
