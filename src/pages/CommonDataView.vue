<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import * as QRCode from 'qrcode'
import {
  type OperatorDataRecord,
  OperatorDataRequestError,
  uploadOperatorDataByLegacySession,
  uploadOperatorDataByOpenApiToken,
} from '../api/operator-data-api'
import SecondaryPageHeader from '../components/SecondaryPageHeader.vue'
import {
  checkSklandQrStatus,
  createSklandQrCode,
  extractOfficialToken,
  getSklandBindingAccounts,
  getSklandCredentialByOfficialToken,
  getSklandOperatorCharacters,
  mapSklandCharactersToOperatorData,
  parseSklandCredential,
  type SklandBindingAccount,
  type SklandCredential,
  SklandRequestError,
} from '../api/skland-operator-api'
import { createMessage } from '../utils/message'

type OperatorDataSource = 'none' | 'skland' | 'manual'

interface OperatorRecord extends OperatorDataRecord {
  id: string
  name: string
}

const operatorRows = reactive<OperatorRecord[]>([])
const importDialog = ref(false)
const importText = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const sklandCredentialDialog = ref(false)
const sklandCredentialInput = ref('')
const officialTokenDialog = ref(false)
const officialTokenInput = ref('')
const accountDialog = ref(false)
const bindingAccounts = ref<SklandBindingAccount[]>([])
const pendingSklandCredential = ref<SklandCredential | null>(null)
const selectedAccountLabel = ref('')
const qrDialog = ref(false)
const qrImage = ref('')
const qrScanId = ref('')
const qrStatus = ref('')
const qrError = ref('')
const isCreatingQr = ref(false)
const isCheckingQr = ref(false)
const cloudTokenDialog = ref(false)
const cloudTokenInput = ref('')
const pendingSaveRecords = ref<OperatorDataRecord[] | null>(null)
const isLoadingOperators = ref(false)
const isLoadingAccounts = ref(false)
const isSavingOperators = ref(false)
const operatorDataSource = ref<OperatorDataSource>('none')
const operatorDataLoadedAt = ref<Date | null>(null)
const operatorLoadError = ref('')
const openApiWriteToken = ref('')
const searchKeyword = ref('')
const onlyOwned = ref(false)
const selectedRarity = ref('all')
let qrPollTimer: number | null = null
let operatorIdSeed = 0

const eliteOptions = [
  { title: '未精英化', value: 0 },
  { title: '精英化 1', value: 1 },
  { title: '精英化 2', value: 2 },
]
const rarityOptions = [1, 2, 3, 4, 5, 6].map((value) => ({
  title: `${value} 星`,
  value,
}))
const potentialOptions = [
  { title: '未设置', value: 0 },
  ...[1, 2, 3, 4, 5, 6].map((value) => ({ title: `潜能 ${value}`, value })),
]
const skillLevelOptions = [
  { title: '未升级', value: 0 },
  ...[1, 2, 3, 4, 5, 6, 7].map((value) => ({ title: `等级 ${value}`, value })),
]
const masteryOptions = [
  { title: '未专精', value: 0 },
  { title: '专精 1', value: 1 },
  { title: '专精 2', value: 2 },
  { title: '专精 3', value: 3 },
]
const moduleOptions = [
  { title: '未解锁', value: 0 },
  { title: '模组 1', value: 1 },
  { title: '模组 2', value: 2 },
  { title: '模组 3', value: 3 },
]
const operatorCount = computed(
  () => operatorRows.filter((operator) => operator.charId.trim().length > 0).length,
)
const ownedCount = computed(
  () => operatorRows.filter((operator) => operator.charId.trim() && operator.own).length,
)
const filteredOperatorRows = computed(() => {
  const keyword = searchKeyword.value.trim().toLocaleLowerCase()
  return operatorRows.filter((operator) => {
    if (onlyOwned.value && !operator.own) return false
    if (selectedRarity.value !== 'all' && operator.rarity !== Number(selectedRarity.value)) {
      return false
    }
    if (!keyword) return true
    return (
      operator.name.toLocaleLowerCase().includes(keyword) ||
      operator.charId.toLocaleLowerCase().includes(keyword)
    )
  })
})

const toolImportStatus = computed(() => {
  if (isLoadingOperators.value || isLoadingAccounts.value || isCreatingQr.value) {
    return { label: '处理中', detail: '正在从森空岛读取干员数据', tone: 'loading' }
  }
  if (operatorDataSource.value === 'skland') {
    return {
      label: '已载入',
      detail: selectedAccountLabel.value
        ? `森空岛 · ${selectedAccountLabel.value}`
        : '森空岛账号数据',
      tone: 'ready',
    }
  }
  if (operatorDataSource.value === 'manual') {
    return { label: '手动数据', detail: '本地文件或粘贴内容', tone: 'manual' }
  }
  return { label: '待导入', detail: '选择一种外部数据来源', tone: 'waiting' }
})

const editorSourceLabel = computed(() => {
  if (operatorDataSource.value === 'skland') {
    return selectedAccountLabel.value ? `森空岛 · ${selectedAccountLabel.value}` : '森空岛'
  }
  if (operatorDataSource.value === 'manual') return '本地导入'
  return '尚未导入'
})

function createEmptyOperator(): OperatorRecord {
  operatorIdSeed += 1
  return {
    id: `operator-${operatorIdSeed}`,
    name: '',
    charId: '',
    own: true,
    level: 1,
    elite: 0,
    potential: 1,
    rarity: 1,
    mainSkill: 0,
    skill1: 0,
    skill2: 0,
    skill3: 0,
    modX: 0,
    modY: 0,
    modD: 0,
    modA: 0,
    modB: 0,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number') return String(value)
  }
  return ''
}

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, Math.round(number)))
}

function readNumber(
  record: Record<string, unknown>,
  keys: string[],
  fallback: number,
  min: number,
  max: number,
): number {
  for (const key of keys) {
    const value = record[key]
    if (value === '' || value === null || value === undefined) continue
    const number = Number(value)
    if (Number.isFinite(number)) return Math.min(max, Math.max(min, Math.round(number)))
  }
  return fallback
}

function readBoolean(record: Record<string, unknown>, keys: string[], fallback = false): boolean {
  for (const key of keys) {
    const value = record[key]
    if (value === true || value === 1 || value === '1' || value === 'true') return true
    if (value === false || value === 0 || value === '0' || value === 'false') return false
  }
  return fallback
}

function readSkillValue(record: Record<string, unknown>, index: number): number {
  const skills = record.skills ?? record.skill
  if (Array.isArray(skills)) {
    const skill = skills[index - 1]
    if (isRecord(skill)) return readNumber(skill, ['level', 'mastery', 'rank'], 0, 0, 3)
    return clampNumber(skill, 0, 0, 3)
  }
  if (isRecord(skills)) {
    return readNumber(skills, [`skill${index}`, String(index), `skill_${index}`], 0, 0, 3)
  }
  return readNumber(record, [`skill${index}`, `skill${index}Mastery`, `skill_${index}`], 0, 0, 3)
}

function readModuleValue(
  record: Record<string, unknown>,
  key: string,
  legacyModule: boolean,
): number {
  return readNumber(record, [key], legacyModule ? 1 : 0, 0, 3)
}

function normalizeOperator(
  value: unknown,
  index: number,
  existingName = '',
): OperatorRecord | null {
  if (!isRecord(value)) return null

  const charId = readString(value, ['charId', 'operatorId', 'id'])
  const name =
    readString(value, ['name', 'operatorName', 'charName', 'displayName']) ||
    existingName ||
    charId ||
    `干员 ${index + 1}`
  const own = readBoolean(value, ['own', 'owned'], Boolean(charId))
  const legacyModule = readBoolean(value, ['module', 'hasModule', 'moduleActive'])

  return {
    id: `operator-${++operatorIdSeed}`,
    name,
    charId,
    own,
    level: readNumber(value, ['level', 'currentLevel'], own ? 1 : 0, 0, 90),
    elite: readNumber(value, ['elite', 'elitePhase', 'phase'], 0, 0, 2),
    potential: readNumber(value, ['potential', 'potentialRank'], own ? 1 : 0, 0, 6),
    rarity: readNumber(value, ['rarity', 'star'], 1, 1, 6),
    mainSkill: readNumber(value, ['mainSkill', 'skillLevel'], 0, 0, 7),
    skill1: readSkillValue(value, 1),
    skill2: readSkillValue(value, 2),
    skill3: readSkillValue(value, 3),
    modX: readModuleValue(value, 'modX', legacyModule),
    modY: readModuleValue(value, 'modY', false),
    modD: readModuleValue(value, 'modD', false),
    modA: readModuleValue(value, 'modA', false),
    modB: readModuleValue(value, 'modB', false),
  }
}

function extractOperatorList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload
  if (!isRecord(payload)) throw new Error('JSON 顶层必须是数组，或包含 operators/data 数组')

  for (const key of ['operators', 'operatorData', 'data']) {
    const value = payload[key]
    if (Array.isArray(value)) return value
    if (isRecord(value) && Array.isArray(value.operators)) return value.operators
  }
  throw new Error('没有找到干员数组，请检查 JSON 数据结构')
}

function normalizeOperators(values: unknown[]): OperatorRecord[] {
  return values
    .map((value, index) => normalizeOperator(value, index))
    .filter((value): value is OperatorRecord => value !== null)
}

function parseOperatorJson(text: string): OperatorRecord[] {
  let payload: unknown
  try {
    payload = JSON.parse(text)
  } catch {
    throw new Error('JSON 格式不正确')
  }

  const records = normalizeOperators(extractOperatorList(payload))
  if (!records.length) throw new Error('没有找到可识别的干员记录')
  return records
}

function applyOperatorRows(records: OperatorRecord[], source: OperatorDataSource): void {
  operatorRows.splice(0, operatorRows.length, ...records)
  operatorDataSource.value = source
  if (source !== 'skland') selectedAccountLabel.value = ''
  operatorDataLoadedAt.value = new Date()
  operatorLoadError.value = ''
}

function applyImportedOperators(records: OperatorRecord[]): void {
  applyOperatorRows(records, 'manual')
  importText.value = ''
  importDialog.value = false
  createMessage({ text: `已导入 ${records.length} 名干员`, type: 'success' })
}

function openPasteDialog(): void {
  importText.value = ''
  importDialog.value = true
}

function applyPasteImport(): void {
  try {
    applyImportedOperators(parseOperatorJson(importText.value))
  } catch (error) {
    createMessage({
      text: error instanceof Error ? error.message : '导入失败，请检查数据',
      type: 'warning',
    })
  }
}

async function handleFileImport(event: Event): Promise<void> {
  const input = event.currentTarget as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  try {
    applyImportedOperators(parseOperatorJson(await file.text()))
  } catch (error) {
    createMessage({
      text: error instanceof Error ? error.message : '文件导入失败，请检查 JSON 数据',
      type: 'warning',
    })
  } finally {
    input.value = ''
  }
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof OperatorDataRequestError || error instanceof SklandRequestError) {
    return error.message
  }
  if (error instanceof Error && error.message) return error.message
  return fallback
}

async function prepareAccountSelection(credential: SklandCredential): Promise<boolean> {
  isLoadingAccounts.value = true
  operatorLoadError.value = ''
  try {
    const accounts = await getSklandBindingAccounts(credential)
    if (!accounts.length) throw new Error('未找到绑定的明日方舟账号')
    pendingSklandCredential.value = credential
    bindingAccounts.value = accounts
    accountDialog.value = true
    return true
  } catch (error) {
    operatorLoadError.value = getErrorMessage(error, '森空岛账号读取失败')
    return false
  } finally {
    isLoadingAccounts.value = false
  }
}

function openSklandCredentialDialog(): void {
  operatorLoadError.value = ''
  sklandCredentialInput.value = ''
  sklandCredentialDialog.value = true
}

function closeSklandCredentialDialog(): void {
  sklandCredentialDialog.value = false
  sklandCredentialInput.value = ''
}

async function submitSklandCredential(): Promise<void> {
  if (isLoadingAccounts.value) return
  try {
    const credential = parseSklandCredential(sklandCredentialInput.value)
    if (await prepareAccountSelection(credential)) closeSklandCredentialDialog()
  } catch (error) {
    operatorLoadError.value = getErrorMessage(error, '森空岛凭证格式不正确')
  }
}

function openOfficialTokenDialog(): void {
  operatorLoadError.value = ''
  officialTokenInput.value = ''
  officialTokenDialog.value = true
}

function closeOfficialTokenDialog(): void {
  officialTokenDialog.value = false
  officialTokenInput.value = ''
}

async function submitOfficialToken(): Promise<void> {
  if (isLoadingAccounts.value) return
  try {
    const officialToken = extractOfficialToken(officialTokenInput.value)
    const credential = await getSklandCredentialByOfficialToken(officialToken)
    if (await prepareAccountSelection(credential)) closeOfficialTokenDialog()
  } catch (error) {
    operatorLoadError.value = getErrorMessage(error, '官网 Token 处理失败')
  }
}

async function importFromSklandAccount(account: SklandBindingAccount): Promise<void> {
  const credential = pendingSklandCredential.value
  if (!credential || isLoadingOperators.value) return

  isLoadingOperators.value = true
  operatorLoadError.value = ''
  try {
    const characters = await getSklandOperatorCharacters(credential, account.uid)
    const records = normalizeOperators(mapSklandCharactersToOperatorData(characters))
    if (!records.length) throw new Error('森空岛没有返回可识别的干员记录')

    selectedAccountLabel.value = [account.nickName || account.uid, account.channelName]
      .filter(Boolean)
      .join(' · ')
    applyOperatorRows(records, 'skland')
    accountDialog.value = false
    pendingSklandCredential.value = null
    bindingAccounts.value = []
    createMessage({ text: `已载入 ${records.length} 名干员`, type: 'success' })
  } catch (error) {
    operatorLoadError.value = getErrorMessage(error, '森空岛干员数据读取失败')
  } finally {
    isLoadingOperators.value = false
  }
}

function closeAccountDialog(): void {
  if (isLoadingOperators.value) return
  accountDialog.value = false
  pendingSklandCredential.value = null
  bindingAccounts.value = []
}

function handleAccountDialogChange(open: boolean): void {
  if (open) {
    accountDialog.value = true
    return
  }
  closeAccountDialog()
}

function stopQrPolling(): void {
  if (qrPollTimer !== null) {
    window.clearInterval(qrPollTimer)
    qrPollTimer = null
  }
}

function startQrPolling(): void {
  stopQrPolling()
  qrPollTimer = window.setInterval(() => {
    void pollQrStatus()
  }, 2000)
}

async function createQrSession(): Promise<void> {
  stopQrPolling()
  qrImage.value = ''
  qrScanId.value = ''
  qrError.value = ''
  qrStatus.value = '正在生成二维码...'
  isCreatingQr.value = true
  try {
    const qr = await createSklandQrCode()
    qrScanId.value = qr.scanId
    qrImage.value = await QRCode.toDataURL(qr.qrContent, {
      width: 240,
      margin: 1,
      errorCorrectionLevel: 'M',
    })
    if (!qrDialog.value) return
    qrStatus.value = '请使用森空岛 APP 扫描二维码并确认授权'
    startQrPolling()
  } catch (error) {
    qrError.value = getErrorMessage(error, '二维码生成失败，请稍后重试')
    qrStatus.value = ''
  } finally {
    isCreatingQr.value = false
  }
}

async function pollQrStatus(): Promise<void> {
  if (!qrScanId.value || isCheckingQr.value) return
  isCheckingQr.value = true
  try {
    const result = await checkSklandQrStatus(qrScanId.value)
    if (result.status === 0) {
      if (!result.cred || !result.token) throw new Error('扫码成功，但未获取到森空岛凭证')
      stopQrPolling()
      qrStatus.value = '扫码成功，正在获取账号列表...'
      qrDialog.value = false
      await prepareAccountSelection({ cred: result.cred, token: result.token })
    } else if (result.status === 102) {
      stopQrPolling()
      qrStatus.value = '二维码已过期，请重新生成'
    }
  } catch (error) {
    stopQrPolling()
    qrError.value = getErrorMessage(error, '二维码状态读取失败，请重新生成')
  } finally {
    isCheckingQr.value = false
  }
}

function openQrImportDialog(): void {
  qrDialog.value = true
  void createQrSession()
}

function handleQrDialogChange(open: boolean): void {
  qrDialog.value = open
  if (!open) stopQrPolling()
}

function openCloudTokenDialog(): void {
  cloudTokenInput.value = ''
  cloudTokenDialog.value = true
}

function closeCloudTokenDialog(): void {
  cloudTokenDialog.value = false
  cloudTokenInput.value = ''
  pendingSaveRecords.value = null
}

async function submitCloudToken(): Promise<void> {
  const token = cloudTokenInput.value.trim()
  if (!token) {
    createMessage({ text: '请输入云端写入 Token', type: 'warning' })
    return
  }

  openApiWriteToken.value = token
  const records = pendingSaveRecords.value
  pendingSaveRecords.value = null
  cloudTokenDialog.value = false
  cloudTokenInput.value = ''
  if (records) await persistOperatorData(records)
}

function addOperator(): void {
  operatorRows.push(createEmptyOperator())
}

function removeOperator(index: number): void {
  operatorRows.splice(index, 1)
}

function toApiRecord(operator: OperatorRecord): OperatorDataRecord {
  const own = operator.own === true
  return {
    charId: operator.charId.trim(),
    own,
    level: clampNumber(operator.level, own ? 1 : 0, 0, 90),
    elite: clampNumber(operator.elite, 0, 0, 2),
    potential: clampNumber(operator.potential, own ? 1 : 0, 0, 6),
    rarity: clampNumber(operator.rarity, 1, 1, 6),
    mainSkill: clampNumber(operator.mainSkill, 0, 0, 7),
    skill1: clampNumber(operator.skill1, 0, 0, 3),
    skill2: clampNumber(operator.skill2, 0, 0, 3),
    skill3: clampNumber(operator.skill3, 0, 0, 3),
    modX: clampNumber(operator.modX, 0, 0, 3),
    modY: clampNumber(operator.modY, 0, 0, 3),
    modD: clampNumber(operator.modD, 0, 0, 3),
    modA: clampNumber(operator.modA, 0, 0, 3),
    modB: clampNumber(operator.modB, 0, 0, 3),
  }
}

function prepareRecordsForSave(): OperatorDataRecord[] | null {
  const filledRows = operatorRows.filter((operator) => operator.charId.trim())
  if (!filledRows.length) {
    createMessage({ text: '请至少填写一名干员 ID', type: 'warning' })
    return null
  }

  const records = filledRows.map(toApiRecord)
  const ids = new Set<string>()
  if (records.some((record) => ids.has(record.charId) || !ids.add(record.charId))) {
    createMessage({ text: '干员 ID 不能重复', type: 'warning' })
    return null
  }

  const names = new Map(filledRows.map((operator) => [operator.charId.trim(), operator.name]))
  const normalizedRows = records.map((record, index) => {
    const existing = filledRows[index]
    return {
      ...record,
      id: existing?.id || `operator-${++operatorIdSeed}`,
      name: names.get(record.charId) || record.charId,
    }
  })
  operatorRows.splice(0, operatorRows.length, ...normalizedRows)
  return records
}

async function persistOperatorData(records: OperatorDataRecord[]): Promise<void> {
  if (isSavingOperators.value) return
  isSavingOperators.value = true
  try {
    const legacyToken =
      typeof localStorage === 'undefined' ? '' : (localStorage.getItem('USER_TOKEN') || '').trim()
    if (legacyToken && legacyToken !== 'null' && legacyToken !== 'undefined') {
      await uploadOperatorDataByLegacySession(legacyToken, records)
    } else if (openApiWriteToken.value.trim()) {
      await uploadOperatorDataByOpenApiToken(openApiWriteToken.value, records)
    } else {
      pendingSaveRecords.value = records
      isSavingOperators.value = false
      openCloudTokenDialog()
      createMessage({ text: '保存到酸橙云需要写入凭证', type: 'info' })
      return
    }
    operatorDataLoadedAt.value = new Date()
    createMessage({ text: `已保存 ${records.length} 名干员`, type: 'success' })
  } catch (error) {
    createMessage({ text: getErrorMessage(error, '干员数据保存失败'), type: 'error' })
  } finally {
    isSavingOperators.value = false
  }
}

function saveManualData(): void {
  const records = prepareRecordsForSave()
  if (!records) return
  void persistOperatorData(records)
}

onBeforeUnmount(() => {
  stopQrPolling()
})
</script>

<template>
  <main class="common-data-page">
    <SecondaryPageHeader
      title-id="common-data-title"
      kicker="COMMON DATA"
      title-a="通用数据维护"
      description="维护干员信息等通用于各大项目的数据"
    >
      <template #visual>
        <div class="common-data-header-texture" aria-hidden="true">
          <span class="common-data-pattern-stack common-data-pattern-stack-back"></span>
          <span class="common-data-pattern-stack common-data-pattern-stack-middle"></span>
          <span class="common-data-pattern-stack common-data-pattern-stack-front"></span>
          <span class="common-data-pattern-rule common-data-pattern-rule-top"></span>
          <span class="common-data-pattern-rule common-data-pattern-rule-middle"></span>
          <span class="common-data-pattern-rule common-data-pattern-rule-bottom"></span>
          <span class="common-data-pattern-marker common-data-pattern-marker-blue"></span>
          <span class="common-data-pattern-marker common-data-pattern-marker-pink"></span>
          <span class="common-data-pattern-marker common-data-pattern-marker-green"></span>
          <span class="common-data-pattern-scan"></span>
        </div>
      </template>
    </SecondaryPageHeader>
    <section class="operator-import-section" aria-labelledby="operator-import-title">
      <div class="operator-section-heading">
        <div>
          <p class="operator-section-label">01 / IMPORT</p>
          <h2 id="operator-import-title">导入你的干员数据。</h2>
          <p>选择适合当前数据来源的方式。导入成功后，可以继续在下方手动修正。</p>
        </div>
      </div>

      <div class="operator-import-grid">
        <article class="operator-import-card operator-import-card-skland">
          <div class="operator-card-top">
            <span>01</span>
            <span
              :class="['operator-card-status', `operator-card-status-${toolImportStatus.tone}`]"
            >
              {{ toolImportStatus.label }}
            </span>
          </div>
          <div class="operator-import-icon">
            <v-icon icon="mdi-key-outline" size="28"></v-icon>
          </div>
          <h3>森空岛凭证</h3>
          <p>输入森空岛凭证，先选择绑定的明日方舟账号，再载入干员数据。</p>
          <div class="operator-import-card-detail">
            <v-icon icon="mdi-shield-check-outline" size="15"></v-icon>
            <span>{{ toolImportStatus.detail }}</span>
          </div>
          <p v-if="operatorLoadError" class="operator-import-error">{{ operatorLoadError }}</p>
          <div class="operator-import-card-actions">
            <button
              class="operator-import-action"
              type="button"
              :disabled="isLoadingAccounts || isLoadingOperators"
              @click="openSklandCredentialDialog"
            >
              <v-icon icon="mdi-arrow-right" size="16"></v-icon>
              输入凭证
            </button>
          </div>
        </article>

        <article class="operator-import-card operator-import-card-official">
          <div class="operator-card-top">
            <span>02</span>
            <span class="operator-card-status">可用</span>
          </div>
          <div class="operator-import-icon">
            <v-icon icon="mdi-shield-key-outline" size="28"></v-icon>
          </div>
          <h3>官网 Token</h3>
          <p>粘贴官网 account/info/hg 返回的完整 JSON，换取森空岛凭证后读取。</p>
          <button class="operator-import-action" type="button" @click="openOfficialTokenDialog">
            <v-icon icon="mdi-arrow-right" size="16"></v-icon>
            粘贴 Token
          </button>
        </article>

        <article class="operator-import-card operator-import-card-qr">
          <div class="operator-card-top">
            <span>03</span>
            <span class="operator-card-status">可用</span>
          </div>
          <div class="operator-import-icon">
            <v-icon icon="mdi-qrcode-scan" size="28"></v-icon>
          </div>
          <h3>森空岛扫码登录</h3>
          <p>使用森空岛 APP 扫码确认，自动获取凭证并选择账号。</p>
          <button class="operator-import-action" type="button" @click="openQrImportDialog">
            <v-icon icon="mdi-qrcode" size="16"></v-icon>
            打开二维码
          </button>
        </article>

        <article class="operator-import-card operator-import-card-file">
          <div class="operator-card-top">
            <span>04</span>
            <span class="operator-card-status">可用</span>
          </div>
          <div class="operator-import-icon">
            <v-icon icon="mdi-file-upload-outline" size="28"></v-icon>
          </div>
          <h3>上传 JSON 文件</h3>
          <p>选择本地导出的 JSON 文件，校验后载入编辑器。</p>
          <button class="operator-import-action" type="button" @click="fileInput?.click()">
            <v-icon icon="mdi-upload" size="16"></v-icon>
            选择文件
          </button>
          <input
            id="operator-json-file"
            ref="fileInput"
            class="operator-file-input"
            type="file"
            accept=".json,application/json"
            @change="handleFileImport"
          />
        </article>

        <article class="operator-import-card operator-import-card-paste">
          <div class="operator-card-top">
            <span>05</span>
            <span class="operator-card-status">可用</span>
          </div>
          <div class="operator-import-icon">
            <v-icon icon="mdi-content-paste" size="28"></v-icon>
          </div>
          <h3>粘贴 JSON 数据</h3>
          <p>将工具导出的 JSON 文本粘贴进来，校验后载入编辑器。</p>
          <button class="operator-import-action" type="button" @click="openPasteDialog">
            <v-icon icon="mdi-content-paste" size="16"></v-icon>
            粘贴数据
          </button>
        </article>
      </div>
    </section>

    <section class="operator-editor-section" aria-labelledby="operator-editor-title">
      <div class="operator-section-heading">
        <div>
          <p class="operator-section-label">02 / MANUAL EDITOR</p>
          <h2 id="operator-editor-title">手动编辑干员数据。</h2>
          <p>适合补录少量干员，或对导入结果进行细节调整。</p>
        </div>
        <div class="operator-editor-summary">
          <span>已填写</span>
          <strong>{{ operatorCount }}</strong>
          <small>名干员</small>
        </div>
      </div>

      <div class="operator-editor-shell">
        <div class="operator-editor-toolbar">
          <div class="operator-editor-toolbar-copy">
            <span class="operator-editor-label">当前编辑列表</span>
            <strong>{{ operatorCount }} 名干员 · {{ ownedCount }} 名已拥有</strong>
            <small>来源：{{ editorSourceLabel }}</small>
          </div>
          <div class="operator-editor-toolbar-controls">
            <v-text-field
              v-model="searchKeyword"
              class="operator-search-field"
              label="搜索干员或 charId"
              prepend-inner-icon="mdi-magnify"
              variant="outlined"
              density="compact"
              clearable
              hide-details
            ></v-text-field>
            <v-select
              v-model="selectedRarity"
              class="operator-rarity-filter"
              label="星级"
              :items="[{ title: '全部星级', value: 'all' }, ...rarityOptions]"
              variant="outlined"
              density="compact"
              hide-details
            ></v-select>
            <v-checkbox
              v-model="onlyOwned"
              class="operator-owned-filter"
              label="只看已拥有"
              density="compact"
              hide-details
            ></v-checkbox>
            <div class="operator-editor-actions">
              <button class="operator-editor-secondary" type="button" @click="addOperator">
                <v-icon icon="mdi-plus" size="16"></v-icon>
                添加干员
              </button>
              <button
                class="operator-editor-primary"
                type="button"
                :disabled="isSavingOperators"
                @click="saveManualData"
              >
                <v-icon icon="mdi-content-save-outline" size="16"></v-icon>
                {{ isSavingOperators ? '保存中' : '保存到酸橙云' }}
              </button>
            </div>
          </div>
        </div>

        <div v-if="filteredOperatorRows.length" class="operator-editor-list">
          <article
            v-for="(operator, index) in filteredOperatorRows"
            :key="operator.id"
            class="operator-editor-row"
          >
            <div class="operator-row-top">
              <div class="operator-row-identity">
                <span class="operator-row-index">{{ String(index + 1).padStart(2, '0') }}</span>
                <div>
                  <h3>{{ operator.name || '未命名干员' }}</h3>
                  <code>{{ operator.charId || '填写 charId 后才可云端保存' }}</code>
                </div>
              </div>
              <div class="operator-row-actions">
                <span
                  :class="['operator-own-status', { 'operator-own-status-active': operator.own }]"
                >
                  {{ operator.own ? '已拥有' : '未拥有' }}
                </span>
                <button
                  class="operator-row-remove"
                  type="button"
                  :aria-label="`删除 ${operator.name || `第 ${index + 1} 条`} 干员记录`"
                  title="删除这条记录"
                  @click="removeOperator(operatorRows.indexOf(operator))"
                >
                  <v-icon icon="mdi-delete-outline" size="17"></v-icon>
                </button>
              </div>
            </div>

            <div class="operator-row-summary">
              <div class="operator-summary-metric">
                <span>等级</span>
                <strong>{{ operator.level || '-' }}</strong>
              </div>
              <div class="operator-summary-metric">
                <span>精英化</span>
                <strong>{{ operator.elite }}</strong>
              </div>
              <div class="operator-summary-metric">
                <span>潜能</span>
                <strong>{{ operator.potential || '-' }}</strong>
              </div>
              <div class="operator-summary-wide">
                <span>技能等级</span>
                <strong
                  >{{ operator.mainSkill }} / {{ operator.skill1 }} / {{ operator.skill2 }} /
                  {{ operator.skill3 }}</strong
                >
              </div>
              <div class="operator-summary-wide">
                <span>模组 X · Y · D · A · B</span>
                <strong
                  >{{ operator.modX }} · {{ operator.modY }} · {{ operator.modD }} ·
                  {{ operator.modA }} · {{ operator.modB }}</strong
                >
              </div>
            </div>

            <div class="operator-editor-fields-heading">
              <span>编辑资料</span>
              <small>保存时按共享数据字段提交</small>
            </div>

            <div class="operator-row-fields">
              <v-text-field
                v-model="operator.charId"
                class="operator-char-id-field"
                label="干员 charId"
                variant="outlined"
                density="comfortable"
                maxlength="80"
                hide-details
              ></v-text-field>
              <v-text-field
                v-model="operator.name"
                class="operator-name-field"
                label="显示名称（可选）"
                variant="outlined"
                density="comfortable"
                maxlength="40"
                hide-details
              ></v-text-field>
              <v-checkbox
                v-model="operator.own"
                class="operator-own-field"
                label="已拥有"
                density="compact"
                hide-details
              ></v-checkbox>
              <v-select
                v-model="operator.rarity"
                label="星级"
                variant="outlined"
                density="comfortable"
                :items="rarityOptions"
                hide-details
              ></v-select>
              <v-text-field
                v-model.number="operator.level"
                type="number"
                label="等级"
                variant="outlined"
                density="comfortable"
                min="0"
                max="90"
                hide-details
              ></v-text-field>
              <v-select
                v-model="operator.elite"
                label="精英化"
                variant="outlined"
                density="comfortable"
                :items="eliteOptions"
                hide-details
              ></v-select>
              <v-select
                v-model="operator.potential"
                label="潜能"
                variant="outlined"
                density="comfortable"
                :items="potentialOptions"
                hide-details
              ></v-select>
            </div>

            <div class="operator-row-skill-fields">
              <span class="operator-field-group-label">技能等级</span>
              <v-select
                v-model="operator.mainSkill"
                label="通用技能"
                variant="outlined"
                density="comfortable"
                :items="skillLevelOptions"
                hide-details
              ></v-select>
              <v-select
                v-model="operator.skill1"
                label="技能一专精"
                variant="outlined"
                density="comfortable"
                :items="masteryOptions"
                hide-details
              ></v-select>
              <v-select
                v-model="operator.skill2"
                label="技能二专精"
                variant="outlined"
                density="comfortable"
                :items="masteryOptions"
                hide-details
              ></v-select>
              <v-select
                v-model="operator.skill3"
                label="技能三专精"
                variant="outlined"
                density="comfortable"
                :items="masteryOptions"
                hide-details
              ></v-select>
            </div>

            <div class="operator-row-module-fields">
              <span class="operator-field-group-label">模组等级</span>
              <v-select
                v-model="operator.modX"
                label="X 分支"
                variant="outlined"
                density="comfortable"
                :items="moduleOptions"
                hide-details
              ></v-select>
              <v-select
                v-model="operator.modY"
                label="Y 分支"
                variant="outlined"
                density="comfortable"
                :items="moduleOptions"
                hide-details
              ></v-select>
              <v-select
                v-model="operator.modD"
                label="D 分支"
                variant="outlined"
                density="comfortable"
                :items="moduleOptions"
                hide-details
              ></v-select>
              <v-select
                v-model="operator.modA"
                label="A 分支"
                variant="outlined"
                density="comfortable"
                :items="moduleOptions"
                hide-details
              ></v-select>
              <v-select
                v-model="operator.modB"
                label="B 分支"
                variant="outlined"
                density="comfortable"
                :items="moduleOptions"
                hide-details
              ></v-select>
            </div>
          </article>
        </div>

        <div
          v-else-if="operatorRows.length"
          class="operator-editor-empty operator-editor-empty-filtered"
        >
          <v-icon icon="mdi-filter-off-outline" size="30"></v-icon>
          <h3>没有匹配的干员。</h3>
          <p>调整搜索关键词或筛选条件后再试。</p>
        </div>

        <div v-else class="operator-editor-empty">
          <v-icon icon="mdi-account-plus-outline" size="30"></v-icon>
          <h3>从一名干员开始。</h3>
          <p>选择一种导入方式，或点击“添加干员”创建手动记录。</p>
          <button class="operator-editor-secondary" type="button" @click="addOperator">
            <v-icon icon="mdi-plus" size="16"></v-icon>
            添加第一名干员
          </button>
        </div>
      </div>

      <p class="operator-editor-note">外部凭证只用于本次读取，保存到酸橙云需要单独的写入凭证。</p>
    </section>

    <footer class="common-data-footer">
      <span>酸橙云 · 让工具数据跟着用户走</span>
      <RouterLink to="/projects">
        查看工具授权
        <v-icon icon="mdi-arrow-top-right" size="16"></v-icon>
      </RouterLink>
    </footer>

    <v-dialog v-model="importDialog" max-width="620" scrollable>
      <v-card class="operator-import-dialog">
        <v-card-title>粘贴干员 JSON 数据</v-card-title>
        <v-card-text>
          <v-textarea
            v-model="importText"
            label="JSON 数据"
            variant="outlined"
            rows="10"
            auto-grow
            placeholder='[{\n  "name": "能天使",\n  "level": 90,\n  "elite": 2,\n  "potential": 6,\n  "skills": [3, 3, 3]\n}]'
          ></v-textarea>
          <p class="operator-import-dialog-hint">
            支持 JSON 数组，或包含 operators、operatorData、data 数组的 JSON 对象。
          </p>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="importDialog = false">取消</v-btn>
          <v-btn color="primary" @click="applyPasteImport">
            <v-icon icon="mdi-import" start></v-icon>
            导入并编辑
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="sklandCredentialDialog" max-width="560">
      <v-card class="operator-token-dialog">
        <v-card-title>输入森空岛凭证</v-card-title>
        <v-card-text>
          <p class="operator-token-dialog-copy">粘贴森空岛凭证，格式为 cred,token。</p>
          <v-textarea
            v-model="sklandCredentialInput"
            class="operator-token-input"
            label="森空岛凭证"
            rows="3"
            autocomplete="off"
            variant="outlined"
            density="comfortable"
            hide-details
            placeholder="cred,token"
          ></v-textarea>
          <p v-if="operatorLoadError" class="operator-import-error">{{ operatorLoadError }}</p>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="closeSklandCredentialDialog">取消</v-btn>
          <v-btn color="primary" :loading="isLoadingAccounts" @click="submitSklandCredential">
            读取账号
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="officialTokenDialog" max-width="620">
      <v-card class="operator-token-dialog">
        <v-card-title>输入官网 Token</v-card-title>
        <v-card-text>
          <p class="operator-token-dialog-copy">
            粘贴明日方舟官网 account/info/hg 返回的完整 JSON。
          </p>
          <v-textarea
            v-model="officialTokenInput"
            class="operator-token-input"
            label="官网 Token JSON"
            rows="8"
            auto-grow
            autocomplete="off"
            variant="outlined"
            density="comfortable"
            hide-details
          ></v-textarea>
          <p v-if="operatorLoadError" class="operator-import-error">{{ operatorLoadError }}</p>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="closeOfficialTokenDialog">取消</v-btn>
          <v-btn color="primary" :loading="isLoadingAccounts" @click="submitOfficialToken">
            读取账号
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog
      :model-value="accountDialog"
      max-width="560"
      @update:model-value="handleAccountDialogChange"
    >
      <v-card class="operator-account-dialog">
        <v-card-title>选择明日方舟账号</v-card-title>
        <v-card-text>
          <p class="operator-token-dialog-copy">选择要载入干员数据的账号。</p>
          <div class="operator-account-list">
            <button
              v-for="account in bindingAccounts"
              :key="account.uid + '-' + account.channelMasterId"
              class="operator-account-option"
              type="button"
              :disabled="isLoadingOperators"
              @click="importFromSklandAccount(account)"
            >
              <span class="operator-account-option-copy">
                <strong>{{ account.nickName || account.uid }}</strong>
                <small>{{ account.channelName }} · UID {{ account.uid }}</small>
              </span>
              <v-icon
                :icon="isLoadingOperators ? 'mdi-loading' : 'mdi-arrow-right'"
                size="18"
              ></v-icon>
            </button>
          </div>
          <p v-if="operatorLoadError" class="operator-import-error">{{ operatorLoadError }}</p>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" :disabled="isLoadingOperators" @click="closeAccountDialog">
            取消
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog :model-value="qrDialog" max-width="460" @update:model-value="handleQrDialogChange">
      <v-card class="operator-qr-dialog">
        <v-card-title>森空岛扫码登录</v-card-title>
        <v-card-text class="operator-qr-dialog-body">
          <div v-if="qrImage" class="operator-qr-image-wrap">
            <img class="operator-qr-image" :src="qrImage" alt="森空岛登录二维码" />
          </div>
          <v-progress-circular v-else-if="isCreatingQr" indeterminate color="primary" />
          <p class="operator-qr-status">{{ qrStatus || '二维码暂不可用' }}</p>
          <p v-if="qrError" class="operator-import-error">{{ qrError }}</p>
        </v-card-text>
        <v-card-actions>
          <v-btn variant="text" :disabled="isCreatingQr" @click="createQrSession">
            <v-icon icon="mdi-refresh" start></v-icon>
            重新生成
          </v-btn>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="handleQrDialogChange(false)">关闭</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="cloudTokenDialog" max-width="560">
      <v-card class="operator-token-dialog">
        <v-card-title>配置云端写入凭证</v-card-title>
        <v-card-text>
          <p class="operator-token-dialog-copy">
            外部导入不会写入酸橙云；保存当前编辑结果时需要提供写入 Token。
          </p>
          <v-text-field
            v-model="cloudTokenInput"
            class="operator-token-input"
            label="云端写入 Token"
            type="password"
            autocomplete="off"
            variant="outlined"
            density="comfortable"
            hide-details
            @keyup.enter="submitCloudToken"
          ></v-text-field>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="closeCloudTokenDialog">取消</v-btn>
          <v-btn color="primary" @click="submitCloudToken">使用并保存</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </main>
</template>

<style scoped>
.common-data-page {
  width: min(1120px, calc(100% - 64px));
  margin: 0 auto;
  padding: 30px 0 76px;
}

.common-data-header {
  position: relative;
  isolation: isolate;
  display: flex;
  flex-direction: column;
  min-height: 360px;
  padding: 32px 66px 40px;
  overflow: hidden;
  border-left: 12px solid var(--site-accent);
  background: var(--site-surface);
  box-shadow: 10px 10px 0 var(--site-pink);
}

.common-data-header-copy {
  position: relative;
  z-index: 1;
  margin-top: auto;
}

.operator-import-action:focus-visible,
.operator-editor-primary:focus-visible,
.operator-editor-secondary:focus-visible,
.operator-row-remove:focus-visible,
.operator-editor-empty button:focus-visible {
  outline: 3px solid var(--site-warm);
  outline-offset: 3px;
}

.operator-section-label {
  margin: 0;
  color: var(--site-accent);
  font-size: 12px;
  font-weight: 750;
  letter-spacing: 0.08em;
}

.common-data-header h1 {
  max-width: 760px;
  margin: 0;
  color: var(--site-ink);
  font-size: 54px;
  font-weight: 650;
  line-height: 0.98;
}

.common-data-header h1 em {
  color: var(--site-accent);
  font-style: normal;
}

.common-data-intro {
  max-width: 480px;
  margin: 22px 0 0;
  color: var(--site-muted);
  font-size: 15px;
  line-height: 1.8;
}

.common-data-header-texture {
  --pattern-blue: rgb(25 118 197 / 0.32);
  --pattern-blue-soft: rgb(25 118 197 / 0.08);
  --pattern-pink: rgb(239 120 168 / 0.58);
  --pattern-green: rgb(54 191 200 / 0.58);
  position: absolute;
  z-index: 0;
  inset: 0 0 0 auto;
  width: 100%;
  overflow: hidden;
  pointer-events: none;
}

.common-data-header-texture::before {
  position: absolute;
  inset: 14% 0 10% 8%;
  background:
    linear-gradient(
      90deg,
      transparent 0 12%,
      var(--pattern-blue-soft) 12% 12.3%,
      transparent 12.3% 100%
    ),
    linear-gradient(
      0deg,
      transparent 0 18%,
      var(--pattern-blue-soft) 18% 18.5%,
      transparent 18.5% 100%
    );
  -webkit-mask-image: linear-gradient(90deg, transparent 0%, #000 30%, #000 100%);
  mask-image: linear-gradient(90deg, transparent 0%, #000 30%, #000 100%);
  content: '';
}

.common-data-header-texture::after {
  position: absolute;
  top: 15%;
  bottom: 12%;
  left: 10%;
  width: 1px;
  background: var(--pattern-pink);
  content: '';
  animation: common-data-pattern-scan 8s ease-in-out infinite;
  opacity: 0;
}

.common-data-pattern-stack {
  position: absolute;
  width: 72%;
  height: 31%;
  border: 1px solid var(--pattern-blue);
  background: rgb(255 253 246 / 0.15);
  transform: skewY(-7deg);
}

.common-data-pattern-stack::before {
  position: absolute;
  top: 28%;
  left: 12%;
  width: 48%;
  height: 1px;
  background: var(--pattern-blue);
  box-shadow:
    0 17px 0 var(--pattern-blue-soft),
    0 34px 0 var(--pattern-blue-soft);
  content: '';
}

.common-data-pattern-stack::after {
  position: absolute;
  top: 22%;
  right: 12%;
  width: 16px;
  height: 16px;
  border: 1px solid currentColor;
  color: var(--pattern-blue);
  content: '';
}

.common-data-pattern-stack-back {
  top: 12%;
  right: 0;
  opacity: 0.5;
}

.common-data-pattern-stack-middle {
  top: 27%;
  right: 10%;
  border-color: var(--pattern-pink);
  color: var(--pattern-pink);
  opacity: 0.72;
}

.common-data-pattern-stack-middle::before {
  background: var(--pattern-pink);
  box-shadow:
    0 17px 0 rgb(239 120 168 / 0.16),
    0 34px 0 rgb(239 120 168 / 0.16);
}

.common-data-pattern-stack-front {
  top: 42%;
  right: 20%;
  border-color: var(--pattern-green);
  color: var(--pattern-green);
  opacity: 0.9;
}

.common-data-pattern-stack-front::before {
  background: var(--pattern-green);
  box-shadow:
    0 17px 0 rgb(54 191 200 / 0.16),
    0 34px 0 rgb(54 191 200 / 0.16);
}

.common-data-pattern-rule {
  position: absolute;
  height: 1px;
  background: var(--pattern-blue);
}

.common-data-pattern-rule-top {
  top: 24%;
  left: 3%;
  width: 26%;
}

.common-data-pattern-rule-middle {
  top: 56%;
  left: 0;
  width: 22%;
  background: var(--pattern-pink);
}

.common-data-pattern-rule-bottom {
  right: 0;
  bottom: 15%;
  width: 34%;
  background: var(--pattern-green);
}

.common-data-pattern-marker {
  position: absolute;
  width: 9px;
  height: 9px;
  border: 1px solid currentColor;
  background: var(--site-surface);
  color: var(--pattern-blue);
  animation: common-data-pattern-pulse 6s ease-in-out infinite;
}

.common-data-pattern-marker-blue {
  top: 22%;
  left: 7%;
}

.common-data-pattern-marker-pink {
  top: 55%;
  left: 21%;
  color: var(--pattern-pink);
  animation-delay: -1s;
}

.common-data-pattern-marker-green {
  right: 11%;
  bottom: 14%;
  color: var(--pattern-green);
  animation-delay: -2s;
}

.common-data-pattern-scan {
  position: absolute;
  top: 13%;
  bottom: 10%;
  left: 14%;
  width: 2px;
  background: var(--pattern-pink);
  opacity: 0;
  animation: common-data-pattern-scan 8s ease-in-out infinite;
}

@keyframes common-data-pattern-scan {
  0%,
  12% {
    left: 14%;
    opacity: 0;
  }

  28%,
  72% {
    opacity: 0.24;
  }

  88%,
  100% {
    left: 88%;
    opacity: 0;
  }
}

@keyframes common-data-pattern-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 transparent;
    transform: scale(1);
  }

  48% {
    box-shadow: 0 0 0 3px rgb(25 118 197 / 0.1);
    transform: scale(1.06);
  }

  62% {
    box-shadow: 0 0 0 0 transparent;
    transform: scale(1);
  }
}

.operator-section-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 28px;
}

.operator-section-heading h2 {
  margin: 8px 0 0;
  color: var(--site-ink);
  font-size: 32px;
  font-weight: 700;
  line-height: 1.15;
}

.operator-section-heading p:last-child {
  max-width: 560px;
  margin: 10px 0 0;
  color: var(--site-muted);
  font-size: 13px;
  line-height: 1.7;
}

.operator-import-section,
.operator-editor-section {
  padding-top: 48px;
}

.operator-import-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  padding-top: 22px;
}

.operator-import-card {
  display: flex;
  min-height: 330px;
  flex-direction: column;
  padding: 22px 24px 24px;
  border: 1px solid var(--site-line);
  border-top: 5px solid var(--site-accent);
  border-radius: 8px;
  background: var(--site-surface);
}

.operator-import-card-file {
  border-top-color: var(--site-pink);
}

.operator-import-card-paste {
  border-top-color: var(--site-green);
}

.operator-import-card-official {
  border-top-color: #7a7ee8;
}

.operator-import-card-qr {
  border-top-color: #2aa99c;
}

.operator-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: var(--site-muted);
  font-size: 10px;
  font-weight: 750;
  letter-spacing: 0.1em;
}

.operator-card-status {
  padding: 5px 8px;
  background: var(--site-accent-soft);
  color: var(--site-accent);
  letter-spacing: 0;
}

.operator-card-status-loading {
  background: #fff4ce;
  color: #997000;
}

.operator-card-status-ready {
  background: #def6ef;
  color: #1d9e91;
}

.operator-card-status-manual {
  background: #ffe7ef;
  color: #dd5d8c;
}

.operator-card-status-waiting {
  background: #edf1f4;
  color: var(--site-muted);
}

.operator-import-card-file .operator-card-status {
  background: #ffe7ef;
  color: #dd5d8c;
}

.operator-import-card-paste .operator-card-status {
  background: #def6ef;
  color: #1d9e91;
}

.operator-import-card-official .operator-card-status {
  background: #e9e8ff;
  color: #5f62bd;
}

.operator-import-card-qr .operator-card-status {
  background: #def6ef;
  color: #1d9e91;
}

.operator-import-icon {
  display: grid;
  width: 64px;
  height: 64px;
  margin: 37px 0 20px;
  place-items: center;
  border-radius: 18px;
  background: var(--site-accent-soft);
  color: var(--site-accent);
}

.operator-import-card-file .operator-import-icon {
  background: #ffe7ef;
  color: #dd5d8c;
}

.operator-import-card-paste .operator-import-icon {
  background: #def6ef;
  color: #1d9e91;
}

.operator-import-card-official .operator-import-icon {
  background: #e9e8ff;
  color: #5f62bd;
}

.operator-import-card-qr .operator-import-icon {
  background: #def6ef;
  color: #1d9e91;
}

.operator-import-card h3 {
  margin: 0;
  color: var(--site-ink);
  font-size: 22px;
  font-weight: 750;
}

.operator-import-card p {
  margin: 10px 0 0;
  color: var(--site-muted);
  font-size: 12px;
  line-height: 1.7;
}

.operator-import-action,
.operator-editor-primary,
.operator-editor-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 35px;
  padding: 8px 11px;
  border: 0;
  cursor: pointer;
  font-size: 11px;
  font-weight: 750;
}

.operator-import-action:disabled,
.operator-editor-primary:disabled,
.operator-editor-secondary:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.operator-import-action {
  align-self: flex-start;
  margin-top: auto;
  background: var(--site-accent);
  color: var(--site-surface);
}

.operator-import-action-muted {
  background: var(--site-paper);
  color: var(--site-muted);
}

.operator-import-card-detail {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  min-height: 38px;
  margin-top: 16px;
  color: var(--site-muted);
  font-size: 11px;
  line-height: 1.5;
}

.operator-import-card-detail .v-icon {
  flex: 0 0 auto;
  color: var(--site-accent);
}

.operator-import-error {
  margin: 8px 0 0 !important;
  color: #c34b5f !important;
  font-size: 11px !important;
  line-height: 1.5 !important;
}

.operator-import-card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: auto;
  padding-top: 18px;
}

.operator-import-card-actions .operator-import-action {
  margin-top: 0;
}

.operator-import-action:hover,
.operator-editor-primary:hover,
.operator-editor-secondary:hover {
  filter: brightness(0.95);
}

.operator-file-input {
  display: none;
}

.operator-editor-summary {
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding: 8px 0 4px;
  color: var(--site-muted);
}

.operator-editor-summary span,
.operator-editor-summary small {
  font-size: 11px;
}

.operator-editor-summary strong {
  color: var(--site-accent);
  font-size: 40px;
  font-weight: 750;
  line-height: 1;
}

.operator-editor-shell {
  margin-top: 22px;
  border: 1px solid var(--site-line);
  background: var(--site-surface);
}

.operator-editor-toolbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  padding: 18px 22px;
  border-bottom: 1px solid var(--site-line);
  background: rgb(234 247 247 / 0.5);
}

.operator-editor-toolbar > div:first-child {
  display: grid;
  gap: 4px;
}

.operator-editor-toolbar-copy {
  min-width: 180px;
}

.operator-editor-toolbar-copy small {
  color: var(--site-muted);
  font-size: 11px;
}

.operator-editor-label {
  color: var(--site-muted);
  font-size: 10px;
  font-weight: 750;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.operator-editor-toolbar strong {
  color: var(--site-ink);
  font-size: 14px;
  font-weight: 750;
}

.operator-editor-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.operator-editor-toolbar-controls {
  display: grid;
  grid-template-columns: minmax(190px, 1.5fr) 126px auto auto;
  align-items: center;
  justify-content: end;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.operator-search-field,
.operator-rarity-filter,
.operator-owned-filter {
  min-width: 0;
  margin: 0;
}

.operator-owned-filter {
  white-space: nowrap;
}

.operator-editor-primary {
  background: var(--site-accent);
  color: var(--site-surface);
}

.operator-editor-secondary {
  border: 1px solid var(--site-line);
  background: var(--site-surface);
  color: var(--site-ink);
}

.operator-editor-list {
  display: grid;
  gap: 14px;
  padding: 14px;
  background: var(--site-paper);
}

.operator-editor-row {
  padding: 22px;
  border: 1px solid var(--site-line);
  border-left: 5px solid var(--site-accent);
  background: var(--site-surface);
}

.operator-editor-row + .operator-editor-row {
  border-top: 1px solid var(--site-line);
}

.operator-row-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.operator-row-identity {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  min-width: 0;
}

.operator-row-index {
  display: grid;
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  place-items: center;
  background: var(--site-accent-soft);
  color: var(--site-accent);
  font-size: 11px;
  font-weight: 800;
}

.operator-row-identity h3 {
  margin: 0;
  overflow-wrap: anywhere;
  color: var(--site-ink);
  font-size: 18px;
  font-weight: 750;
  line-height: 1.25;
}

.operator-row-identity code {
  display: block;
  margin-top: 5px;
  overflow-wrap: anywhere;
  color: var(--site-muted);
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace;
  font-size: 10px;
}

.operator-row-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 0 0 auto;
}

.operator-own-status {
  padding: 5px 8px;
  background: #edf1f4;
  color: var(--site-muted);
  font-size: 10px;
  font-weight: 750;
}

.operator-own-status-active {
  background: #def6ef;
  color: #1d9e91;
}

.operator-row-remove {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: #fff0f2;
  color: #d94f5c;
  cursor: pointer;
}

.operator-row-remove:hover {
  background: #d94f5c;
  color: var(--site-surface);
}

.operator-row-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(80px, 0.65fr)) repeat(2, minmax(170px, 1.4fr));
  gap: 12px;
  align-items: stretch;
  margin-top: 18px;
  padding: 14px;
  border: 1px solid var(--site-line);
  background: var(--site-paper);
}

.operator-summary-metric,
.operator-summary-wide {
  display: grid;
  align-content: center;
  gap: 4px;
  min-width: 0;
}

.operator-summary-metric + .operator-summary-metric,
.operator-summary-wide {
  border-left: 1px solid var(--site-line);
  padding-left: 12px;
}

.operator-summary-metric span,
.operator-summary-wide span {
  color: var(--site-muted);
  font-size: 10px;
  font-weight: 750;
}

.operator-summary-metric strong,
.operator-summary-wide strong {
  overflow-wrap: anywhere;
  color: var(--site-ink);
  font-size: 14px;
  font-weight: 750;
}

.operator-editor-fields-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px solid var(--site-line);
  color: var(--site-ink);
  font-size: 11px;
  font-weight: 750;
}

.operator-editor-fields-heading small {
  color: var(--site-muted);
  font-size: 10px;
  font-weight: 500;
}

.operator-row-fields,
.operator-row-skill-fields,
.operator-row-module-fields {
  display: grid;
  gap: 12px;
  align-items: start;
  margin-top: 12px;
}

.operator-row-fields {
  grid-template-columns: minmax(190px, 1.6fr) minmax(150px, 1.2fr) 90px repeat(
      4,
      minmax(92px, 1fr)
    );
}

.operator-row-skill-fields {
  grid-template-columns: 90px repeat(4, minmax(120px, 1fr));
}

.operator-row-module-fields {
  grid-template-columns: 90px repeat(5, minmax(100px, 1fr));
}

.operator-field-group-label {
  align-self: center;
  color: var(--site-muted);
  font-size: 11px;
  font-weight: 750;
}

.operator-editor-empty {
  display: grid;
  justify-items: center;
  gap: 10px;
  padding: 60px 24px;
  color: var(--site-muted);
  text-align: center;
}

.operator-editor-empty .v-icon {
  color: var(--site-accent);
}

.operator-editor-empty h3 {
  color: var(--site-ink);
  font-size: 22px;
  font-weight: 700;
}

.operator-editor-empty p {
  margin: 0 0 10px;
  font-size: 13px;
}

.operator-editor-note,
.operator-import-dialog-hint {
  margin: 12px 0 0;
  color: var(--site-muted);
  font-size: 11px;
  line-height: 1.6;
}

.common-data-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding-top: 26px;
  color: var(--site-muted);
  font-size: 11px;
}

.common-data-footer a {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--site-ink);
  font-weight: 750;
}

.common-data-footer a:hover {
  color: var(--site-accent);
}

.operator-import-dialog {
  border: 1px solid var(--site-ink);
  border-radius: 8px !important;
  background: var(--site-surface) !important;
}

.operator-token-dialog {
  border: 1px solid var(--site-ink);
  border-radius: 8px !important;
  background: var(--site-surface) !important;
}

.operator-token-dialog-copy,
.operator-token-dialog-hint {
  color: var(--site-muted);
  font-size: 12px;
  line-height: 1.7;
}

.operator-token-dialog-copy {
  margin: 0 0 18px;
}

.operator-token-dialog-hint {
  margin: 12px 0 0;
  font-size: 11px;
}

.operator-token-input {
  margin-top: 14px;
}

.operator-account-dialog,
.operator-qr-dialog {
  border: 1px solid var(--site-ink);
  border-radius: 8px !important;
  background: var(--site-surface) !important;
}

.operator-account-list {
  display: grid;
  gap: 8px;
  margin-top: 16px;
}

.operator-account-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  width: 100%;
  min-height: 64px;
  padding: 12px 14px;
  border: 1px solid var(--site-line);
  background: var(--site-paper);
  color: var(--site-ink);
  cursor: pointer;
  text-align: left;
}

.operator-account-option:hover:not(:disabled) {
  border-color: var(--site-accent);
  background: var(--site-accent-soft);
}

.operator-account-option:disabled {
  cursor: wait;
  opacity: 0.6;
}

.operator-account-option-copy {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.operator-account-option-copy strong {
  overflow-wrap: anywhere;
  font-size: 14px;
  font-weight: 750;
}

.operator-account-option-copy small {
  overflow-wrap: anywhere;
  color: var(--site-muted);
  font-size: 11px;
}

.operator-qr-dialog-body {
  display: grid;
  justify-items: center;
  gap: 12px;
  min-height: 310px;
  align-content: center;
  text-align: center;
}

.operator-qr-image-wrap {
  display: grid;
  width: 260px;
  height: 260px;
  place-items: center;
  border: 1px solid var(--site-line);
  background: #fff;
}

.operator-qr-image {
  display: block;
  width: 240px;
  height: 240px;
}

.operator-qr-status {
  max-width: 320px;
  margin: 0;
  color: var(--site-muted);
  font-size: 12px;
  line-height: 1.6;
}

@media (max-width: 900px) {
  .common-data-page {
    width: min(100% - 48px, 700px);
  }

  .common-data-header {
    min-height: 0;
    padding: 34px 28px 40px;
  }

  .common-data-header-texture {
    width: 100%;
    opacity: 0.6;
  }

  .operator-import-grid {
    grid-template-columns: 1fr;
  }

  .operator-import-card {
    min-height: 0;
  }

  .operator-import-icon {
    margin-top: 25px;
  }

  .operator-editor-toolbar {
    flex-direction: column;
  }

  .operator-editor-toolbar-controls {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    width: 100%;
  }

  .operator-editor-actions {
    justify-content: flex-start;
  }

  .operator-row-summary {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .operator-row-fields,
  .operator-row-skill-fields,
  .operator-row-module-fields {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .operator-char-id-field,
  .operator-name-field {
    grid-column: 1 / -1;
  }

  .operator-field-group-label {
    grid-column: 1 / -1;
  }
}

@media (max-width: 560px) {
  .common-data-page {
    width: calc(100% - 32px);
    padding-top: 24px;
  }

  .common-data-header {
    padding: 26px 20px 32px;
  }

  .common-data-header h1 {
    font-size: 44px;
  }

  .common-data-header-texture {
    opacity: 0.46;
  }

  .operator-section-heading {
    align-items: flex-start;
    flex-direction: column;
    gap: 16px;
  }

  .operator-section-heading h2 {
    font-size: 28px;
  }

  .operator-editor-toolbar {
    align-items: flex-start;
    flex-direction: column;
    padding: 18px;
  }

  .operator-editor-toolbar-controls {
    grid-template-columns: 1fr;
  }

  .operator-editor-row {
    padding: 18px;
  }

  .operator-row-top {
    flex-direction: column;
  }

  .operator-row-actions {
    width: 100%;
    justify-content: space-between;
  }

  .operator-row-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .operator-summary-metric + .operator-summary-metric,
  .operator-summary-wide {
    border-left: 0;
    padding-left: 0;
  }

  .operator-summary-wide {
    grid-column: 1 / -1;
    border-top: 1px solid var(--site-line);
    padding-top: 10px;
  }

  .operator-row-fields,
  .operator-row-skill-fields,
  .operator-row-module-fields {
    grid-template-columns: 1fr;
  }

  .operator-char-id-field,
  .operator-name-field,
  .operator-field-group-label {
    grid-column: auto;
  }

  .operator-editor-summary {
    padding-top: 0;
  }

  .common-data-footer {
    align-items: flex-start;
    flex-direction: column;
  }
}

@media (prefers-reduced-motion: reduce) {
  .common-data-header-texture::after,
  .common-data-pattern-scan,
  .common-data-pattern-marker {
    animation: none;
  }
}
</style>
