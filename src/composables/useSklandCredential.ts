import { onBeforeUnmount, ref } from 'vue'
import * as QRCode from 'qrcode'
import {
  checkSklandQrStatus,
  createSklandQrCode,
  describeSklandError,
  extractOfficialToken,
  getSklandCredentialByOfficialToken,
  resolveCredential,
  type SklandCredential,
} from '../api/skland-core'
import type { SklandImportError } from '../types/skland-import'

/** 凭证获取方式 */
export type CredentialMethod = 'credential' | 'official' | 'qr'

export interface UseSklandCredentialOptions {
  /** 凭证就绪（手工解析 / 官网 Token / 扫码任一路径）后回调，用于加载绑定列表 */
  onReady?: (credential: SklandCredential) => void
  /** 凭证过期被清空后回调，用于清空绑定与选择 */
  onExpired?: () => void
}

const QR_POLL_INTERVAL = 2000
const QR_MAX_SESSION_MS = 5 * 60 * 1000
const QR_MAX_POLL_COUNT = Math.floor(QR_MAX_SESSION_MS / QR_POLL_INTERVAL)
const QR_MAX_CONSECUTIVE_NETWORK_FAILURES = 3

/**
 * 森空岛凭证获取：cred,token / 官网 Token / 扫码 三种来源
 *
 * - 只用内存保存凭证，不落 localStorage
 * - 竞态统一用 disposed + version 令牌，过期响应不回写
 * - 凭证过期（10000/10002）只提示重新获取，不做自动续期，也不调用 /auth/refresh
 * - 扫码会话最多 5 分钟或 150 次轮询，网络连续 3 次失败后停止
 */
export function useSklandCredential(options: UseSklandCredentialOptions = {}) {
  const method = ref<CredentialMethod>('credential')
  const credentialInput = ref('')
  const officialInput = ref('')
  const credential = ref<SklandCredential | null>(null)
  const loading = ref(false)
  const error = ref<SklandImportError | null>(null)

  const qrImage = ref('')
  const qrStatus = ref('')
  const qrLoading = ref(false)

  let disposed = false
  let credentialVersion = 0
  let qrVersion = 0
  let qrTimer: ReturnType<typeof setTimeout> | undefined
  let qrSessionTimer: ReturnType<typeof setTimeout> | undefined
  let qrSessionActive = false
  let qrSessionStartedAt = 0
  let qrPollCount = 0
  let qrNetworkFailureCount = 0

  function cancelQrWork(): void {
    qrVersion += 1
    if (qrTimer !== undefined) clearTimeout(qrTimer)
    qrTimer = undefined
    qrLoading.value = false
  }

  function stopQr(): void {
    cancelQrWork()
    if (qrSessionTimer !== undefined) clearTimeout(qrSessionTimer)
    qrSessionTimer = undefined
    qrSessionActive = false
    qrSessionStartedAt = 0
    qrPollCount = 0
    qrNetworkFailureCount = 0
  }

  function fail(cause: unknown, fallback: string): void {
    const info = describeSklandError(cause, fallback)
    error.value = { game: 'arknights', stage: 'credential', code: info.code, message: info.message }
    if (info.expired) {
      reset()
      error.value = {
        game: 'arknights',
        stage: 'credential',
        code: info.code,
        message: '森空岛凭证已过期，请重新获取凭证',
      }
      options.onExpired?.()
    }
  }

  function reset(): void {
    credentialVersion += 1
    stopQr()
    credential.value = null
    credentialInput.value = ''
    officialInput.value = ''
    qrImage.value = ''
    qrStatus.value = ''
    loading.value = false
    error.value = null
  }

  function clearError(): void {
    error.value = null
  }

  /** 凭证就绪：同一份对象同时供两个 adapter 复用，不重复解析或请求 */
  function apply(value: SklandCredential): void {
    credential.value = value
    error.value = null
    credentialInput.value = ''
    officialInput.value = ''
    options.onReady?.(value)
  }

  /** 手工粘贴 cred,token：纯解析，零网络请求 */
  function submitPair(): void {
    if (loading.value) return
    error.value = null
    let value: SklandCredential
    try {
      value = resolveCredential(credentialInput.value)
    } catch (cause) {
      fail(cause, '凭证格式应为 cred,token')
      return
    }
    apply(value)
  }

  /** 官网 Token：支持通行证 token 或 account/info/hg 的完整 JSON */
  async function submitOfficial(): Promise<void> {
    if (loading.value) return
    const input = officialInput.value.trim()
    error.value = null
    if (!input) {
      error.value = {
        game: 'arknights',
        stage: 'credential',
        message: '请粘贴官网 Token 或 account/info/hg 返回的完整 JSON',
      }
      return
    }

    const version = ++credentialVersion
    loading.value = true
    try {
      const token = input.startsWith('{') ? extractOfficialToken(input) : input
      const value = await getSklandCredentialByOfficialToken(token)
      if (disposed || version !== credentialVersion) return
      apply(value)
    } catch (cause) {
      if (!disposed && version === credentialVersion) fail(cause, '官网 Token 换取凭证失败')
    } finally {
      if (!disposed && version === credentialVersion) loading.value = false
    }
  }

  function stopQrForTimeout(): void {
    if (!qrSessionActive) return
    stopQr()
    qrImage.value = ''
    qrStatus.value = '二维码长时间未确认，请刷新页面或重新进入扫码方式。'
  }

  function canContinueQrSession(): boolean {
    if (!qrSessionActive) return false
    if (
      qrPollCount >= QR_MAX_POLL_COUNT ||
      Date.now() - qrSessionStartedAt >= QR_MAX_SESSION_MS
    ) {
      stopQrForTimeout()
      return false
    }
    return true
  }

  function scheduleQrRetry(callback: () => void, message: string): void {
    qrNetworkFailureCount += 1
    if (qrNetworkFailureCount >= QR_MAX_CONSECUTIVE_NETWORK_FAILURES) {
      stopQr()
      qrStatus.value = '网络请求连续失败，请刷新页面或切换网络环境后重试。'
      return
    }

    qrStatus.value = `${message}，正在重试（${qrNetworkFailureCount}/${QR_MAX_CONSECUTIVE_NETWORK_FAILURES}）…`
    qrTimer = setTimeout(callback, QR_POLL_INTERVAL)
  }

  async function generateQr(): Promise<void> {
    if (!qrSessionActive || method.value !== 'qr' || !canContinueQrSession()) return

    const version = qrVersion
    qrLoading.value = true

    try {
      const session = await createSklandQrCode()
      const image = await QRCode.toDataURL(session.qrContent, { width: 240, margin: 1 })
      if (disposed || version !== qrVersion || !qrSessionActive) return
      qrImage.value = image
      qrStatus.value = '请使用森空岛 APP 扫码，并在手机上确认授权。'
      qrNetworkFailureCount = 0
      qrTimer = setTimeout(() => void pollQr(session.scanId, version), QR_POLL_INTERVAL)
    } catch (cause) {
      if (disposed || version !== qrVersion || !qrSessionActive) return
      scheduleQrRetry(() => void generateQr(), '二维码请求失败')
    } finally {
      if (!disposed && version === qrVersion) qrLoading.value = false
    }
  }

  /** 扫码：开始一个新的二维码会话并自动轮询 */
  function startQr(): void {
    if (loading.value || qrLoading.value) return
    stopQr()
    qrSessionActive = true
    qrSessionStartedAt = Date.now()
    qrSessionTimer = setTimeout(stopQrForTimeout, QR_MAX_SESSION_MS)
    qrImage.value = ''
    qrStatus.value = '正在生成二维码…'
    error.value = null
    qrPollCount = 0
    qrNetworkFailureCount = 0
    void generateQr()
  }

  async function pollQr(scanId: string, version: number): Promise<void> {
    if (!canContinueQrSession()) return
    qrPollCount += 1

    try {
      const result = await checkSklandQrStatus(scanId)
      if (disposed || version !== qrVersion) return

      if (result.status === 0) {
        if (!result.cred || !result.token) {
          stopQr()
          error.value = {
            game: 'arknights',
            stage: 'credential',
            message: '扫码成功，但未获取到有效凭证，请重新扫码',
          }
          return
        }
        stopQr()
        qrImage.value = ''
        qrStatus.value = '扫码成功。'
        apply({ cred: result.cred, token: result.token })
        return
      }

      if (result.status === 102) {
        cancelQrWork()
        qrImage.value = ''
        qrStatus.value = '二维码已过期，正在重新生成。'
        qrTimer = setTimeout(() => void generateQr(), QR_POLL_INTERVAL)
        return
      }

      // status < 0 为无效扫码会话，直接报错停止；其余未覆盖状态同样停下，避免静默空转
      if (result.status !== 100 && result.status !== 101) {
        stopQr()
        error.value = {
          game: 'arknights',
          stage: 'credential',
          code: result.status,
          message:
            result.status < 0
              ? '扫码会话已失效，请刷新页面或重新进入扫码方式'
              : '扫码状态异常，请刷新页面或重新进入扫码方式',
        }
        return
      }

      qrNetworkFailureCount = 0
      qrStatus.value =
        result.status === 101 ? '已扫码，请在手机上确认授权。' : '请使用森空岛 APP 扫码。'
      qrTimer = setTimeout(() => void pollQr(scanId, version), QR_POLL_INTERVAL)
    } catch (cause) {
      if (disposed || version !== qrVersion) return
      scheduleQrRetry(() => void pollQr(scanId, version), '扫码状态请求失败')
    }
  }

  /** 切换获取方式：停轮询并清空与方式相关的输入与状态 */
  function setMethod(next: CredentialMethod): void {
    if (method.value === next) return
    if (next !== 'qr') stopQr()
    method.value = next
    qrImage.value = ''
    qrStatus.value = ''
    credentialInput.value = ''
    officialInput.value = ''
    error.value = null
    if (next === 'qr') startQr()
  }

  onBeforeUnmount(() => {
    disposed = true
    reset()
  })

  return {
    method,
    credentialInput,
    officialInput,
    credential,
    loading,
    error,
    qrImage,
    qrStatus,
    qrLoading,
    setMethod,
    submitPair,
    submitOfficial,
    startQr,
    stopQr,
    reset,
    clearError,
  }
}
