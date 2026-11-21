import axios from 'axios'
import { tclRequest, type TclResponse } from './user-center/request'
import type { GameScope, ImportStage, SklandImportError } from '../types/skland-import'

/**
 * 森空岛请求内核
 *
 * 全项目唯一的森空岛签名、请求与凭证解析实现：
 * - 官方签名接口（zonai.skland.com）：成功判定 `code === 0`
 * - 凭证桥接（auth.yituliu.cn /skland/*）：成功判定 `code === 200`
 * 两类请求器不可混用，错误统一转成 SklandRequestError，且不弹全局气泡，
 * 由调用方决定提示位置（旧页面弹气泡 / 新页面汇总到底部错误区）。
 */

/** 森空岛官方接口域名 */
const SKLAND_BASE_URL = 'https://zonai.skland.com'
/** 签名使用的固定平台标识 */
const SKLAND_PLATFORM = '3'
/** 签名使用的固定设备标识 */
const SKLAND_DEVICE_ID =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/118.0'
/** 签名使用的接口版本号 */
const SKLAND_VERSION = '1.2.0'
/** 森空岛凭证过期错误码 */
const SKLAND_EXPIRED_CODES = [10000, 10002]
/** 凭证桥接成功码（TCL 体系） */
const BRIDGE_SUCCESS_CODE = 200
/** 官方接口成功码（森空岛体系） */
const SKLAND_SUCCESS_CODE = 0

/** 森空岛凭证 */
export interface SklandCredential {
  /** 账号凭证 */
  cred: string
  /** 签名密钥 */
  token: string
}

/** 二维码创建结果 */
export interface SklandQrCode {
  scanId: string
  qrContent: string
}

/** 二维码扫码状态（0 成功 / 100、101 处理中 / 102 过期 / 负数无效） */
export interface SklandQrStatus {
  status: number
  cred?: string
  token?: string
  msg?: string
}

/** 绑定接口响应体 */
export interface SklandBindingPayload {
  list?: Array<{ appCode?: string; bindingList?: unknown[] }>
  [key: string]: unknown
}

/** 森空岛请求错误：页面据此结构化展示（阶段 / 错误码 / 原始原因） */
export class SklandRequestError extends Error {
  status?: number
  code?: number | string

  constructor(message: string, status?: number, code?: number | string) {
    super(message)
    this.name = 'SklandRequestError'
    this.status = status
    this.code = code
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readMessage(payload: unknown): string {
  if (!isRecord(payload)) return ''
  const message = payload.message ?? payload.msg
  return typeof message === 'string' ? message.trim() : ''
}

function readCode(payload: unknown): number | string | undefined {
  if (!isRecord(payload)) return undefined
  const code = payload.code
  return typeof code === 'number' || typeof code === 'string' ? code : undefined
}

/**
 * 把任意请求失败统一转换成 SklandRequestError
 * @param error tclRequest 的 reject 值（响应体）、axios 异常或已有错误
 * @param fallback 无法提取原因时的兜底文案
 */
export function toSklandError(error: unknown, fallback: string): SklandRequestError {
  if (error instanceof SklandRequestError) return error

  // tclRequest 业务失败时 reject 的是响应体本身
  const bodyMessage = readMessage(error)
  if (bodyMessage) {
    return new SklandRequestError(bodyMessage, undefined, readCode(error))
  }

  if (axios.isAxiosError(error)) {
    const status = error.response?.status
    const payloadMessage = readMessage(error.response?.data)
    return new SklandRequestError(
      payloadMessage || (status ? `请求失败（HTTP ${status}）` : error.message || fallback),
      status,
      readCode(error.response?.data),
    )
  }

  if (error instanceof Error && error.message) {
    return new SklandRequestError(error.message)
  }
  return new SklandRequestError(fallback)
}

/** 取错误的可读文案，用于旧页面的气泡提示 */
export function getSklandErrorMessage(error: unknown, fallback: string): string {
  return toSklandError(error, fallback).message
}

/** 错误的结构化描述：页面据此决定动作（过期回步骤 1 / 会话失效重新登录 / 原样展示） */
export interface SklandErrorInfo {
  code?: number | string
  message: string
  /** 森空岛凭证过期（10000 / 10002） */
  expired: boolean
  /** 酸橙云会话失效（80001 / 80002） */
  sessionInvalid: boolean
}

/**
 * 解析错误，给出结构化信息
 * @param error 任意请求异常
 * @param fallback 无法提取原因时的兜底文案
 */
export function describeSklandError(error: unknown, fallback: string): SklandErrorInfo {
  const normalised = toSklandError(error, fallback)
  const code = normalised.code
  return {
    code,
    message: normalised.message,
    expired:
      typeof code === 'number' && SKLAND_EXPIRED_CODES.includes(code),
    sessionInvalid: code === 80001 || code === 80002,
  }
}

/**
 * 把适配层的异常转成页面统一的结构化错误
 * @param error 适配层抛出的异常
 * @param game 所属游戏
 * @param stage 失败阶段
 * @param fallback 兜底文案
 */
export function toSklandImportError(
  error: unknown,
  game: GameScope,
  stage: ImportStage,
  fallback: string,
): SklandImportError {
  const info = describeSklandError(error, fallback)
  return { game, stage, code: info.code, message: info.message }
}

/** 判断错误是否为森空岛凭证过期（10000 / 10002） */
export function isSklandCredentialExpired(error: unknown): boolean {
  return (
    error instanceof SklandRequestError &&
    typeof error.code === 'number' &&
    SKLAND_EXPIRED_CODES.includes(error.code)
  )
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

// 森空岛协议先做 HMAC-SHA256，再把摘要做一次 MD5；Web Crypto 不提供 MD5，故手写实现。
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
  // 预留 300ms 时钟偏差，避免服务端判定请求过期
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

/**
 * 森空岛官方签名接口请求器
 *
 * 成功判定：HTTP 2xx 且 `code === 0`；失败抛 SklandRequestError（带 status / code）。
 * @param path 接口路径，如 /api/v1/game/player/binding
 * @param query 查询串（不含 ?），无则传空串
 * @param credential 森空岛凭证
 * @returns 响应体中的 data 字段
 */
export async function requestSkland<T>(
  path: string,
  query: string,
  credential: SklandCredential,
): Promise<T> {
  const headers = await createSklandHeaders(path, query, credential.cred, credential.token)
  let response
  try {
    response = await axios.get<unknown>(`${SKLAND_BASE_URL}${path}${query ? `?${query}` : ''}`, {
      headers,
      timeout: 15000,
      validateStatus: () => true,
    })
  } catch (error) {
    throw toSklandError(error, '森空岛请求失败，请检查网络')
  }

  const payload = response.data
  const code = readCode(payload)
  const success = code === SKLAND_SUCCESS_CODE || code === String(SKLAND_SUCCESS_CODE)
  if (response.status < 200 || response.status >= 300 || !success) {
    throw new SklandRequestError(
      readMessage(payload) || `森空岛请求失败（HTTP ${response.status}）`,
      response.status,
      code,
    )
  }

  if (!isRecord(payload) || !('data' in payload)) {
    throw new SklandRequestError('森空岛返回的数据格式不正确')
  }
  return payload.data as T
}

/**
 * TCL 凭证桥接请求器（auth.yituliu.cn /skland/*）
 *
 * 成功判定：`code === 200`；失败抛 SklandRequestError（带 code / 原始 msg）。
 * 使用 silent 请求，避免 tclRequest 内部弹全局气泡，提示位置交由调用方决定。
 * @param path 接口路径（可自带查询串），如 /skland/qr/check?scanId=xxx
 * @param body 请求体
 * @returns 响应体中的 data 字段
 */
export async function requestSklandBridge<T>(path: string, body?: unknown): Promise<T> {
  let response: TclResponse<T>
  try {
    response = await tclRequest<T>({
      method: 'POST',
      url: path,
      data: body ?? null,
      auth: false,
      silent: true,
    })
  } catch (error) {
    throw toSklandError(error, '森空岛凭证服务请求失败')
  }

  if (response?.code !== BRIDGE_SUCCESS_CODE) {
    throw new SklandRequestError(
      readMessage(response) || '森空岛凭证服务返回异常',
      undefined,
      response?.code,
    )
  }
  return response.data
}

/**
 * 解析用户粘贴的凭证文本（纯解析，零网络请求）
 *
 * 只接受成对的 `cred,token`；仅 cred 的输入直接报错，不再调用 /api/v1/auth/refresh。
 * @param input 形如 `cred,token` 的字符串，允许包含引号与空白
 * @returns 解析出的 cred 与 token
 */
export function resolveCredential(input: string): SklandCredential {
  const cleaned = (input || '').replace(/\s+/g, '').replace(/["']/g, '')
  const [cred = '', token = ''] = cleaned.split(',')
  if (!cred || !token) {
    throw new SklandRequestError('凭证格式应为 cred,token')
  }
  return { cred, token }
}

function readCredential(value: unknown): SklandCredential {
  if (!isRecord(value)) throw new SklandRequestError('森空岛凭证返回格式不正确')
  const cred = typeof value.cred === 'string' ? value.cred.trim() : ''
  const token = typeof value.token === 'string' ? value.token.trim() : ''
  if (!cred || !token) throw new SklandRequestError('未获取到有效的森空岛凭证')
  return { cred, token }
}

/**
 * 从官网 account/info/hg 返回的 JSON 中取出通行证 token
 * @param input 完整 JSON 文本
 * @returns 通行证 token
 */
export function extractOfficialToken(input: string): string {
  let payload: unknown
  try {
    payload = JSON.parse(input)
  } catch {
    throw new SklandRequestError('内容格式不正确，请复制 account/info/hg 返回的完整 JSON')
  }

  const data = isRecord(payload) && isRecord(payload.data) ? payload.data : undefined
  const token = data && typeof data.content === 'string' ? data.content.trim() : ''
  if (!token) throw new SklandRequestError('未找到 token 字段，请检查复制的内容')
  return token
}

/**
 * 用官网通行证 token 换取森空岛 cred+token
 * @param officialToken 通行证 token
 */
export async function getSklandCredentialByOfficialToken(
  officialToken: string,
): Promise<SklandCredential> {
  const data = await requestSklandBridge<unknown>('/skland/hg/cred-token', {
    token: officialToken.trim(),
  })
  return readCredential(data)
}

/** 创建森空岛扫码登录二维码 */
export async function createSklandQrCode(): Promise<SklandQrCode> {
  const data = await requestSklandBridge<unknown>('/skland/qr/create')
  if (!isRecord(data)) throw new SklandRequestError('二维码返回格式不正确')

  const scanId = typeof data.scanId === 'string' ? data.scanId.trim() : ''
  const qrContent = typeof data.qrContent === 'string' ? data.qrContent.trim() : ''
  if (!scanId || !qrContent) throw new SklandRequestError('二维码信息不完整')
  return { scanId, qrContent }
}

/**
 * 查询扫码状态
 * @param scanId 二维码会话 id
 */
export async function checkSklandQrStatus(scanId: string): Promise<SklandQrStatus> {
  const data = await requestSklandBridge<unknown>(
    `/skland/qr/check?scanId=${encodeURIComponent(scanId)}`,
  )
  if (!isRecord(data) || typeof data.status !== 'number') {
    throw new SklandRequestError('二维码状态返回格式不正确')
  }

  const cred = typeof data.cred === 'string' ? data.cred.trim() : undefined
  const token = typeof data.token === 'string' ? data.token.trim() : undefined
  const msg = typeof data.msg === 'string' ? data.msg : undefined
  return { status: data.status, cred, token, msg }
}

/**
 * 一次获取两个游戏的绑定列表（响应同时含 arknights / endfield，只请求一次）
 * @param credential 森空岛凭证
 */
export function fetchPlayerBinding(credential: SklandCredential): Promise<SklandBindingPayload> {
  return requestSkland<SklandBindingPayload>('/api/v1/game/player/binding', '', credential)
}
