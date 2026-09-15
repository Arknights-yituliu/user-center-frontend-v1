import axios from 'axios'
import { BACKEND_BASE_URL } from './BASE_URL'

/** 一图流干员数据接口的原始字段。名称不是后端持久化字段，可能不存在。 */
export interface OperatorDataRecord {
  charId: string
  own: boolean
  level: number
  elite: number
  potential: number
  rarity: number
  mainSkill: number
  skill1: number
  skill2: number
  skill3: number
  modX: number
  modY: number
  modD: number
  modA: number
  modB: number
  name?: string
}

export class OperatorDataRequestError extends Error {
  status?: number
  code?: number

  constructor(message: string, status?: number, code?: number) {
    super(message)
    this.name = 'OperatorDataRequestError'
    this.status = status
    this.code = code
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getMessage(payload: unknown, fallback: string): string {
  if (!isRecord(payload)) return fallback
  const message = payload.msg ?? payload.message
  return typeof message === 'string' && message.trim() ? message.trim() : fallback
}

function isSuccessCode(value: unknown): boolean {
  return value === undefined || value === 0 || value === 200 || value === '0' || value === '200'
}

function getLegacyAuthorization(token: string): string {
  const trimmedToken = token.trim()
  return trimmedToken.startsWith('Authorization') ? trimmedToken : `Authorization${trimmedToken}`
}

function getLegacyUid(): string {
  if (typeof localStorage === 'undefined') return ''
  const uid = localStorage.getItem('UID') || ''
  return /^-?\d+$/.test(uid) ? uid : ''
}

async function requestOperatorApi(
  path: string,
  token: string,
  method: 'GET' | 'POST',
  data?: unknown,
  includeLegacyUid = false,
): Promise<unknown> {
  const headers: Record<string, string> = {
    Authorization: token,
  }
  if (includeLegacyUid) {
    const uid = getLegacyUid()
    if (uid) headers.uid = uid
  }

  const response = await axios.request<unknown>({
    baseURL: BACKEND_BASE_URL,
    url: path,
    method,
    data,
    headers,
    timeout: 15000,
    validateStatus: () => true,
  })

  const payload = response.data
  const code = isRecord(payload) ? payload.code : undefined
  if (response.status < 200 || response.status >= 300 || !isSuccessCode(code)) {
    throw new OperatorDataRequestError(
      getMessage(payload, `请求失败（HTTP ${response.status}）`),
      response.status,
      typeof code === 'number' ? code : undefined,
    )
  }

  return payload
}

/** 将本页编辑结果保存到酸橙云，不参与外部干员数据导入。 */
export async function uploadOperatorDataByLegacySession(
  token: string,
  records: OperatorDataRecord[],
): Promise<void> {
  await requestOperatorApi(
    '/auth/survey/operator/upload',
    getLegacyAuthorization(token),
    'POST',
    records,
    true,
  )
}

/** 使用工具专属写入 Token 保存本页编辑结果，不参与外部干员数据导入。 */
export async function uploadOperatorDataByOpenApiToken(
  token: string,
  records: OperatorDataRecord[],
): Promise<void> {
  await requestOperatorApi('/open-api/operator/upload', token.trim(), 'POST', records)
}
