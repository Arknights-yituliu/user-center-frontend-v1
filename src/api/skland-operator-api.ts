import axios from 'axios'
import { BACKEND_BASE_URL } from './BASE_URL'

const SKLAND_BASE_URL = 'https://zonai.skland.com'
const SKLAND_BINDING_PATH = '/api/v1/game/player/binding'
const SKLAND_CULTIVATE_PATH = '/api/v1/game/cultivate/player'
const SKLAND_PLATFORM = '3'
const SKLAND_DEVICE_ID =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/118.0'
const SKLAND_VERSION = '1.2.0'

export interface SklandCredential {
  cred: string
  token: string
}

export interface SklandBindingAccount {
  uid: string
  nickName: string
  channelName: string
  channelMasterId: number
  isOfficial?: boolean
}

export interface SklandOperatorCharacter {
  id: string
  name?: string
  rarity?: number
  level: number
  evolvePhase: number
  potentialRank: number
  mainSkillLevel: number
  skills?: Array<{ level?: number } | null>
  equips?: Array<{ id?: string; level?: number; typeName2?: string } | null>
}

export interface SklandQrCode {
  scanId: string
  qrContent: string
}

export interface SklandQrStatus {
  status: number
  cred?: string
  token?: string
}

export class SklandRequestError extends Error {
  status?: number
  code?: number

  constructor(message: string, status?: number, code?: number) {
    super(message)
    this.name = 'SklandRequestError'
    this.status = status
    this.code = code
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getMessage(payload: unknown, fallback: string): string {
  if (!isRecord(payload)) return fallback
  const message = payload.message ?? payload.msg
  return typeof message === 'string' && message.trim() ? message.trim() : fallback
}

function isSuccessCode(value: unknown): boolean {
  return value === 0 || value === '0'
}

function isBackendSuccessCode(value: unknown): boolean {
  return value === undefined || value === 0 || value === 200 || value === '0' || value === '200'
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('')
}

async function hmacSha256Hex(message: string, secret: string): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new SklandRequestError('当前浏览器不支持森空岛请求签名')
  }

  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await globalThis.crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(message),
  )
  return bytesToHex(new Uint8Array(signature))
}

function rotateLeft(value: number, shift: number): number {
  return ((value << shift) | (value >>> (32 - shift))) >>> 0
}

function wordToLittleEndianHex(value: number): string {
  return [0, 8, 16, 24]
    .map((shift) => ((value >>> shift) & 0xff).toString(16).padStart(2, '0'))
    .join('')
}

// The Skland protocol hashes the HMAC hex digest with MD5. Web Crypto does not expose MD5.
function md5Hex(input: string): string {
  const bytes = new TextEncoder().encode(input)
  const bitLength = bytes.length * 8
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64
  const message = new Uint8Array(paddedLength)
  message.set(bytes)
  message[bytes.length] = 0x80

  const view = new DataView(message.buffer)
  view.setUint32(paddedLength - 8, bitLength >>> 0, true)
  view.setUint32(paddedLength - 4, Math.floor(bitLength / 0x100000000), true)

  const shifts = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9,
    14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ]
  const constants = Array.from(
    { length: 64 },
    (_, index) => Math.floor(Math.abs(Math.sin(index + 1)) * 0x100000000) >>> 0,
  )

  let a0 = 0x67452301
  let b0 = 0xefcdab89
  let c0 = 0x98badcfe
  let d0 = 0x10325476

  for (let offset = 0; offset < paddedLength; offset += 64) {
    const words = new Uint32Array(16)
    for (let index = 0; index < 16; index += 1) {
      words[index] = view.getUint32(offset + index * 4, true)
    }

    let a = a0
    let b = b0
    let c = c0
    let d = d0

    for (let index = 0; index < 64; index += 1) {
      let functionValue: number
      let wordIndex: number

      if (index < 16) {
        functionValue = (b & c) | (~b & d)
        wordIndex = index
      } else if (index < 32) {
        functionValue = (d & b) | (~d & c)
        wordIndex = (5 * index + 1) % 16
      } else if (index < 48) {
        functionValue = b ^ c ^ d
        wordIndex = (3 * index + 5) % 16
      } else {
        functionValue = c ^ (b | ~d)
        wordIndex = (7 * index) % 16
      }

      const next = (a + functionValue + constants[index]! + words[wordIndex]!) >>> 0
      a = d
      d = c
      c = b
      b = (b + rotateLeft(next, shifts[index]!)) >>> 0
    }

    a0 = (a0 + a) >>> 0
    b0 = (b0 + b) >>> 0
    c0 = (c0 + c) >>> 0
    d0 = (d0 + d) >>> 0
  }

  return [a0, b0, c0, d0].map(wordToLittleEndianHex).join('')
}

async function createSklandHeaders(
  path: string,
  query: string,
  cred: string,
  token: string,
): Promise<Record<string, string>> {
  const timestamp = Math.floor((Date.now() - 300) / 1000).toString()
  const unsignedHeaders = {
    platform: SKLAND_PLATFORM,
    timestamp,
    dId: SKLAND_DEVICE_ID,
    vName: SKLAND_VERSION,
  }
  const signingText = `${path}${query}${timestamp}${JSON.stringify(unsignedHeaders)}`
  const hmac = await hmacSha256Hex(signingText, token)

  return {
    ...unsignedHeaders,
    cred,
    sign: md5Hex(hmac),
  }
}

async function requestSkland<T>(
  path: string,
  query: string,
  credential: SklandCredential,
): Promise<T> {
  const headers = await createSklandHeaders(path, query, credential.cred, credential.token)
  const response = await axios.get<unknown>(
    `${SKLAND_BASE_URL}${path}${query ? `?${query}` : ''}`,
    {
      headers,
      timeout: 15000,
      validateStatus: () => true,
    },
  )
  const payload = response.data
  const code = isRecord(payload) ? payload.code : undefined
  if (response.status < 200 || response.status >= 300 || !isSuccessCode(code)) {
    throw new SklandRequestError(
      getMessage(payload, `森空岛请求失败（HTTP ${response.status}）`),
      response.status,
      typeof code === 'number' ? code : undefined,
    )
  }

  if (!isRecord(payload) || !('data' in payload)) {
    throw new SklandRequestError('森空岛返回的数据格式不正确')
  }
  return payload.data as T
}

async function requestBackend<T>(
  path: string,
  data?: unknown,
  params?: Record<string, string>,
): Promise<T> {
  const response = await axios.post<unknown>(`${BACKEND_BASE_URL}${path}`, data, {
    params,
    timeout: 15000,
    validateStatus: () => true,
  })
  const payload = response.data
  const code = isRecord(payload) ? payload.code : undefined
  if (response.status < 200 || response.status >= 300 || !isBackendSuccessCode(code)) {
    throw new SklandRequestError(
      getMessage(payload, `请求失败（HTTP ${response.status}）`),
      response.status,
      typeof code === 'number' ? code : undefined,
    )
  }
  return payload as T
}

function getBackendData(payload: unknown): unknown {
  if (!isRecord(payload) || !('data' in payload)) return payload
  return payload.data
}

function readCredential(value: unknown): SklandCredential {
  if (!isRecord(value)) throw new SklandRequestError('森空岛凭证返回格式不正确')
  const cred = typeof value.cred === 'string' ? value.cred.trim() : ''
  const token = typeof value.token === 'string' ? value.token.trim() : ''
  if (!cred || !token) throw new SklandRequestError('未获取到有效的森空岛凭证')
  return { cred, token }
}

export function parseSklandCredential(input: string): SklandCredential {
  const parts = input.replace(/\s+/g, '').replace(/["']/g, '').split(',')
  const cred = parts[0] || ''
  const token = parts[1] || ''
  if (!cred || !token) throw new SklandRequestError('凭证格式应为 cred,token')
  return { cred, token }
}

export function extractOfficialToken(input: string): string {
  let payload: unknown
  try {
    payload = JSON.parse(input)
  } catch {
    throw new SklandRequestError('内容格式不正确，请粘贴 account/info/hg 返回的完整 JSON')
  }

  const data = isRecord(payload) && isRecord(payload.data) ? payload.data : undefined
  const token = data && typeof data.content === 'string' ? data.content.trim() : ''
  if (!token) throw new SklandRequestError('未找到 data.content，请检查复制的官网 Token 内容')
  return token
}

export async function getSklandCredentialByOfficialToken(
  officialToken: string,
): Promise<SklandCredential> {
  const payload = await requestBackend<Record<string, unknown>>('/survey/hg/cred-token', {
    token: officialToken.trim(),
  })
  return readCredential(getBackendData(payload))
}

export async function createSklandQrCode(): Promise<SklandQrCode> {
  const payload = await requestBackend<Record<string, unknown>>('/survey/skland/qr/create')
  const data = getBackendData(payload)
  if (!isRecord(data)) throw new SklandRequestError('二维码返回格式不正确')

  const scanId = typeof data.scanId === 'string' ? data.scanId.trim() : ''
  const qrContent = typeof data.qrContent === 'string' ? data.qrContent.trim() : ''
  if (!scanId || !qrContent) throw new SklandRequestError('二维码信息不完整')
  return { scanId, qrContent }
}

export async function checkSklandQrStatus(scanId: string): Promise<SklandQrStatus> {
  const payload = await requestBackend<Record<string, unknown>>(
    '/survey/skland/qr/check',
    undefined,
    {
      scanId,
    },
  )
  const data = getBackendData(payload)
  if (!isRecord(data) || typeof data.status !== 'number') {
    throw new SklandRequestError('二维码状态返回格式不正确')
  }

  const cred = typeof data.cred === 'string' ? data.cred.trim() : undefined
  const token = typeof data.token === 'string' ? data.token.trim() : undefined
  return { status: data.status, cred, token }
}

export async function getSklandBindingAccounts(
  credential: SklandCredential,
): Promise<SklandBindingAccount[]> {
  const data = await requestSkland<{ list?: unknown[] }>(SKLAND_BINDING_PATH, '', credential)
  const applications = Array.isArray(data?.list) ? data.list : []
  const arknights = applications.find(
    (application) => isRecord(application) && application.appCode === 'arknights',
  )
  const bindings =
    isRecord(arknights) && Array.isArray(arknights.bindingList) ? arknights.bindingList : []

  return bindings.flatMap((binding) => {
    if (!isRecord(binding)) return []
    const uid =
      typeof binding.uid === 'string'
        ? binding.uid.trim()
        : typeof binding.uid === 'number'
          ? String(binding.uid)
          : ''
    if (!uid) return []
    return [
      {
        uid,
        nickName: typeof binding.nickName === 'string' ? binding.nickName : '',
        channelName: typeof binding.channelName === 'string' ? binding.channelName : '默认',
        channelMasterId:
          typeof binding.channelMasterId === 'number'
            ? binding.channelMasterId
            : typeof binding.channelMasterId === 'string' && /^-?\d+$/.test(binding.channelMasterId)
              ? Number(binding.channelMasterId)
              : -1,
        isOfficial: binding.isOfficial === true,
      },
    ]
  })
}

export async function getSklandOperatorCharacters(
  credential: SklandCredential,
  uid: string,
): Promise<SklandOperatorCharacter[]> {
  const query = `uid=${encodeURIComponent(uid)}`
  const data = await requestSkland<{ characters?: unknown[] }>(
    SKLAND_CULTIVATE_PATH,
    query,
    credential,
  )
  const characters = Array.isArray(data?.characters) ? data.characters : []

  return characters.flatMap((character) => {
    if (!isRecord(character) || typeof character.id !== 'string' || !character.id.trim()) return []
    const skills = Array.isArray(character.skills)
      ? character.skills.map((skill) =>
          isRecord(skill) && typeof skill.level === 'number' ? { level: skill.level } : null,
        )
      : undefined
    const equips = Array.isArray(character.equips)
      ? character.equips.map((equip) => {
          if (!isRecord(equip)) return null
          return {
            id: typeof equip.id === 'string' ? equip.id : undefined,
            level: typeof equip.level === 'number' ? equip.level : undefined,
            typeName2: typeof equip.typeName2 === 'string' ? equip.typeName2 : undefined,
          }
        })
      : undefined

    return [
      {
        id: character.id.trim(),
        name: typeof character.name === 'string' ? character.name : undefined,
        rarity: typeof character.rarity === 'number' ? character.rarity : undefined,
        level: typeof character.level === 'number' ? character.level : 0,
        evolvePhase: typeof character.evolvePhase === 'number' ? character.evolvePhase : 0,
        potentialRank: typeof character.potentialRank === 'number' ? character.potentialRank : 0,
        mainSkillLevel: typeof character.mainSkillLevel === 'number' ? character.mainSkillLevel : 0,
        skills,
        equips,
      },
    ]
  })
}

export function mapSklandCharactersToOperatorData(characters: SklandOperatorCharacter[]): Array<{
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
}> {
  return characters.map((character) => {
    const skills = character.skills || []
    const moduleLevels = { X: 0, Y: 0, D: 0, A: 0, B: 0 }
    let unknownModuleLevel = 0

    for (const equip of character.equips || []) {
      if (!equip || typeof equip.level !== 'number') continue
      const branch = equip.typeName2?.toUpperCase() as keyof typeof moduleLevels | undefined
      if (branch && branch in moduleLevels) moduleLevels[branch] = equip.level
      else unknownModuleLevel = Math.max(unknownModuleLevel, equip.level)
    }

    return {
      own: true,
      charId: character.id,
      ...(character.name ? { name: character.name } : {}),
      ...(character.rarity ? { rarity: character.rarity } : {}),
      level: character.level,
      elite: character.evolvePhase,
      potential: Math.ceil(character.potentialRank + 1),
      rarity: character.rarity || 1,
      mainSkill: character.mainSkillLevel,
      skill1: skills[0]?.level ?? 0,
      skill2: skills[1]?.level ?? 0,
      skill3: skills[2]?.level ?? 0,
      modX: moduleLevels.X || unknownModuleLevel,
      modY: moduleLevels.Y,
      modD: moduleLevels.D,
      modA: moduleLevels.A,
      modB: moduleLevels.B,
    }
  })
}
