<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import * as QRCode from 'qrcode'
import SecondaryPageHeader from '../components/SecondaryPageHeader.vue'
import { createMessage } from '../utils/message'
import {
  getCredAndSecret,
  getPlayBindingV2,
  getWarehouseInfo,
  type SklandBinding,
  type SklandCredential,
} from '../utils/skland'
import {
  checkSklandQrStatus,
  createSklandQrCode,
  extractOfficialToken,
  getSklandCredentialByOfficialToken,
  SklandRequestError,
} from '../api/skland-operator-api'
import {
  getAkOperators,
  getManualOperators,
  listAkAccounts,
  saveAkOperators,
  saveManualOperators,
  type AkAccountVO,
  type AkOperatorVO,
} from '../api/user-center/ak-account-api'
import { getUcUid } from '../api/user-center/request'
import OperatorCellEditor from '../components/OperatorCellEditor.vue'
import { buildManualUploadPayload, buildRosterRows, type RosterRow } from '../utils/operator-roster'
import {
  getEquipIconUrl,
  getOperatorAvatarUrl,
  getOperatorAvatarStyle,
  getSkillIconUrl,
} from '../utils/arknights-resource'
import {
  EMPTY_OPERATOR_STATIC_DATA,
  getOperatorDisplayName,
  getOperatorEquipIconId,
  getOperatorEquipName,
  getOperatorEntry,
  getOperatorProfessionText,
  getOperatorSkillIconId,
  getOperatorSkillName,
  loadOperatorStaticData,
  type OperatorStaticData,
} from '../utils/operator-table'

/**
 * 游戏数据管理页（/arknights-game-data）
 *
 * 独立于「通用数据维护」页的酸橙云链路：只面对 UC 的 /user/ak-accounts 接口，
 * 用森空岛的三种凭证来源拉取账号数据，选定账号后上传到当前登录用户。
 * 干员数据分页展示，手动修改先保留为本地草稿，点击上传后批量保存修改过的条目到个人手动版。
 */

/** 每页展示的干员行数，保持单页渲染量可控。 */
const PAGE_SIZE = 50

const accounts = ref<AkAccountVO[]>([])
const isLoadingAccounts = ref(false)

/** 当前查看干员数据的账号 uid，空串表示未选择 */
const activeAkUid = ref('')
const activeSource = ref<'skland' | 'manual'>('skland')
const operators = ref<AkOperatorVO[]>([])
const isLoadingOperators = ref(false)
const sourceLoadError = ref(false)

const keyword = ref('')
const rarityFilter = ref<'all' | number>('all')
const ownedFilter = ref<'all' | 0 | 1>('all')
const professionFilter = ref('all')
const yearFilter = ref<'all' | number>('all')
const currentPage = ref(1)

/** 干员静态表（名称 / 星级 / 职业），异步加载，缺失时按 charId 降级展示 */
const operatorStatic = ref<OperatorStaticData>(EMPTY_OPERATOR_STATIC_DATA)

/** 手动修改默认关闭；各数据来源分别保留未上传的草稿。 */
const isManualEditing = ref(false)
const manualDrafts = ref<Record<string, Record<string, RosterRow>>>({})
const sourceKey = computed(() => `${activeSource.value}:${activeAkUid.value || 'new'}`)
const currentDrafts = computed(() => manualDrafts.value[sourceKey.value] || {})
const dirtyCount = computed(() => Object.keys(currentDrafts.value).length)
const isSavingManual = ref(false)
const canStartManualEditing = computed(
  () =>
    Boolean(getUcUid()) &&
    Object.keys(operatorStatic.value.operators).length > 0 &&
    !isLoadingAccounts.value &&
    !isLoadingOperators.value &&
    !sourceLoadError.value &&
    !isSavingManual.value,
)
const canEditOperators = computed(() => isManualEditing.value && canStartManualEditing.value)

/** 可编辑的练度字段 */
type EditableField =
  | 'owned'
  | 'level'
  | 'evolvePhase'
  | 'mainSkillLevel'
  | 'skill1'
  | 'skill2'
  | 'skill3'
  | 'equipX'
  | 'equipY'
  | 'equipD'
  | 'equipA'
  | 'equipB'

/** 数据来源对话框开关 */
const credentialDialog = ref(false)
const officialTokenDialog = ref(false)
const qrDialog = ref(false)
const bindingDialog = ref(false)

const credentialInput = ref('')
const officialTokenInput = ref('')
const pendingCredential = ref<SklandCredential | null>(null)
const bindingList = ref<SklandBinding[]>([])

const qrImage = ref('')
const qrScanId = ref('')
const qrStatus = ref('')
let qrPollTimer: number | null = null

/** 取数与上传过程的忙碌标记 */
const isFetchingBindings = ref(false)
const isUploading = ref(false)
const actionError = ref('')

/** 可选星级筛选项 */
const rarityOptions = [1, 2, 3, 4, 5, 6]
const yearOptions = Array.from({ length: 8 }, (_, index) => 2019 + index)
const professionOptions = computed(() => [
  { title: '全部职业', value: 'all' },
  ...Object.entries(operatorStatic.value.professionLabels).map(([value, title]) => ({
    title,
    value,
  })),
])
const hasActiveFilters = computed(
  () =>
    Boolean(keyword.value.trim()) ||
    rarityFilter.value !== 'all' ||
    ownedFilter.value !== 'all' ||
    professionFilter.value !== 'all' ||
    yearFilter.value !== 'all',
)

function resetRosterFilters(): void {
  keyword.value = ''
  rarityFilter.value = 'all'
  ownedFilter.value = 'all'
  professionFilter.value = 'all'
  yearFilter.value = 'all'
}

/** 补齐完整图鉴，并叠加当前来源的本地草稿；上传从此集合提取修改条目。 */
const rosterRows = computed(() =>
  (!activeAkUid.value && !isManualEditing.value) || sourceLoadError.value
    ? []
    : buildRosterRows(
        operators.value,
        operatorStatic.value,
        currentDrafts.value,
        activeSource.value === 'manual',
      ),
)
const operatorTotal = computed(() => rosterRows.value.length)
const recruitedCount = computed(() => rosterRows.value.filter((row) => row.owned === 1).length)

/**
 * 干员星级：优先用后端记录，缺失（0）时回退到静态表
 * 手动录入的干员常常没填星级，回退后筛选与头像描边才正常
 * @param operator 干员记录
 */
function operatorRarity(operator: AkOperatorVO): number {
  if (operator.rarity) return operator.rarity
  return getOperatorEntry(operatorStatic.value, operator.id)?.rarity || 0
}

/** 关键字、星级、招募状态、职业和实装年份同时匹配，招募状态包含本地草稿的修改。 */
const filteredOperators = computed(() => {
  const text = keyword.value.trim().toLowerCase()
  return rosterRows.value.filter((operator) => {
    if (rarityFilter.value !== 'all' && operatorRarity(operator) !== rarityFilter.value)
      return false
    if (ownedFilter.value !== 'all' && operator.owned !== ownedFilter.value) return false
    const entry = getOperatorEntry(operatorStatic.value, operator.id)
    if (professionFilter.value !== 'all' && entry?.profession !== professionFilter.value)
      return false
    if (yearFilter.value !== 'all' && entry?.releaseYear !== yearFilter.value) return false
    if (!text) return true
    if (operator.id.toLowerCase().includes(text)) return true
    const name = getOperatorDisplayName(operatorStatic.value, operator.id)
    return name.toLowerCase().includes(text)
  })
})

/** 总页数（至少一页） */
const totalPages = computed(() =>
  Math.max(1, Math.ceil(filteredOperators.value.length / PAGE_SIZE)),
)

/** 当前页要渲染的干员行 */
const pageOperators = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE
  return filteredOperators.value.slice(start, start + PAGE_SIZE)
})

/** 森空岛凭证来源卡片的状态文案 */
const credentialCardStatus = computed(() => (isFetchingBindings.value ? '处理中' : '可用'))

// 筛选条件变化后回到第一页，同时避免停留在超出范围的页码
watch([keyword, rarityFilter, ownedFilter, professionFilter, yearFilter], () => {
  currentPage.value = 1
})

watch(totalPages, (value) => {
  if (currentPage.value > value) currentPage.value = value
})

/**
 * 把异常转成可展示的文案
 * @param error 捕获到的异常
 * @param fallback 兜底文案
 */
function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof SklandRequestError) return error.message
  if (error instanceof Error && error.message) return error.message
  return fallback
}

/**
 * 格式化接口返回的时间字符串
 * @param value ISO-8601 时间
 * @returns yyyy-MM-dd HH:mm，解析失败时原样返回
 */
function formatDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value || '-'
  const pad = (input: number): string => String(input).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`
}

/**
 * 干员头像加载失败时隐藏图片，避免表格里出现破图图标
 * （新干员或时装资源尚未同步到 CDN 时会走到这里）
 * @param event img 的 error 事件
 */
function hideBrokenAvatar(event: Event): void {
  const image = event.target as HTMLImageElement | null
  if (image) image.style.visibility = 'hidden'
}

/**
 * 某行第 index 个技能的图标地址（静态表未加载或该干员无此技能时为空串）
 * @param charId 干员编码
 * @param index 技能下标，0/1/2 对应一/二/三技能
 */
function skillIconUrl(charId: string, index: number): string {
  return getSkillIconUrl(getOperatorSkillIconId(operatorStatic.value, charId, index))
}

/**
 * 某行指定槽位的模组图标地址（静态表未加载或该干员无此槽位时为空串）
 * @param charId 干员编码
 * @param slot 模组槽位 X / Y / D / A / B
 */
function equipIconUrl(charId: string, slot: string): string {
  return getEquipIconUrl(getOperatorEquipIconId(operatorStatic.value, charId, slot))
}

/** 技能列悬浮提示：技能位 · 技能名 · 专精等级 */
function skillTitle(charId: string, index: number, level: number): string {
  const slots = ['技能一', '技能二', '技能三']
  const slotLabel = slots[index] || `技能${index + 1}`
  const name = getOperatorSkillName(operatorStatic.value, charId, index)
  return [slotLabel, name, `专精 ${level}`].filter(Boolean).join(' · ')
}

/** 模组列悬浮提示：模组位 · 模组名 · 等级 */
function equipTitle(charId: string, slot: string, level: number): string {
  const name = getOperatorEquipName(operatorStatic.value, charId, slot)
  return [`模组 ${slot}`, name, `${level} 级`].filter(Boolean).join(' · ')
}

/** 模组类型标签，与参考页面的 MAR-X 等命名保持一致。 */
function equipLabel(charId: string, slot: string): string {
  const equip = getOperatorEntry(operatorStatic.value, charId)?.equip?.find(
    (item) => item.typeName2 === slot,
  )
  return equip ? `${equip.typeName1}-${equip.typeName2}` : slot
}

/**
 * 技能 / 模组等级角标图片地址（与一图流同一套资源）
 * 技能用圆点角标（几个点代表专精几级），模组用同系列的阶段角标
 * @param kind skill=技能专精等级，mod=模组等级
 * @param level 等级 1~3，0 表示无角标
 */
function rankBadgeUrl(kind: 'skill' | 'mod', level: number): string {
  if (level <= 0) return ''
  return `${import.meta.env.BASE_URL}image/survey/${kind}-rank-${level}-v1.svg`
}

/**
 * 拉取当前用户已绑定的游戏账号列表
 * 列表返回后自动选中首个账号（最近一次导入的）
 */
async function loadAccounts(): Promise<void> {
  isLoadingAccounts.value = true
  try {
    const response = await listAkAccounts()
    accounts.value = response.data || []
    const first = accounts.value[0]
    if (
      first &&
      !accounts.value.some(
        (account) =>
          account.akUid === activeAkUid.value &&
          (account.source || 'skland') === activeSource.value,
      )
    ) {
      await viewAccount(first.akUid, first.source || 'skland')
    }
  } catch {
    // 业务错误已由 ucRequest 统一提示
  } finally {
    isLoadingAccounts.value = false
  }
}

/**
 * 读取指定账号的干员数据并切换到该账号视图
 * @param akUid 游戏账号 uid
 */
async function viewAccount(akUid: string, source: 'skland' | 'manual' = 'skland'): Promise<void> {
  if (isSavingManual.value) return
  activeAkUid.value = akUid
  activeSource.value = source
  resetRosterFilters()
  currentPage.value = 1
  isLoadingOperators.value = true
  sourceLoadError.value = false
  try {
    const response = await (source === 'manual' ? getManualOperators(akUid) : getAkOperators(akUid))
    operators.value = response.data?.items || []
  } catch {
    operators.value = []
    sourceLoadError.value = true
  } finally {
    isLoadingOperators.value = false
  }
}

/** 修改只写本地草稿，包含 owned=0 的未招募条目，不触发网络请求。 */
function updateOperatorField(row: RosterRow, field: EditableField, value: number): void {
  if (!canEditOperators.value) return
  if (field === 'owned' && value !== 0 && value !== 1) return
  const next: RosterRow = { ...row, [field]: value, dirty: true }
  manualDrafts.value = {
    ...manualDrafts.value,
    [sourceKey.value]: { ...currentDrafts.value, [row.id]: next },
  }
}

/** 明确点击按钮后，将全部分页中修改过的干员一次性上传到用户的手动版。 */
async function uploadManualOperators(): Promise<void> {
  if (!canEditOperators.value || !dirtyCount.value) return
  const rows = rosterRows.value.map((row) => ({
    ...row,
    rarity: operatorRarity(row),
  }))
  const payload = buildManualUploadPayload(rows)
  if (!payload.length) {
    return
  }
  const key = sourceKey.value
  isSavingManual.value = true
  try {
    await saveManualOperators(payload)
    const drafts = { ...manualDrafts.value }
    delete drafts[key]
    manualDrafts.value = drafts
    activeSource.value = 'manual'
    activeAkUid.value = getUcUid()
    // 增量保存后读取真正的手动数据，避免把未上传的森空岛条目误当作已保存的手动记录。
    operators.value = []
    isManualEditing.value = false
    createMessage({ text: `已上传 ${payload.length} 名干员的修改`, type: 'success' })
    isLoadingOperators.value = true
    try {
      const response = await getManualOperators(getUcUid())
      operators.value = response.data?.items || []
      sourceLoadError.value = false
    } catch {
      sourceLoadError.value = true
    } finally {
      isLoadingOperators.value = false
    }
    await loadAccounts()
  } catch {
    // 上传失败保留草稿，用户可直接重试。
  } finally {
    isSavingManual.value = false
  }
}

/** 打开森空岛凭证输入框 */
function openCredentialDialog(): void {
  actionError.value = ''
  credentialInput.value = ''
  credentialDialog.value = true
}

/** 提交森空岛凭证：解析凭证并读取绑定账号列表 */
async function submitCredential(): Promise<void> {
  if (isFetchingBindings.value) return
  isFetchingBindings.value = true
  actionError.value = ''
  try {
    const credential = getCredAndSecret(credentialInput.value)
    if (!credential.cred || !credential.token) throw new Error('凭证格式应为 cred,token')

    const binding = await getPlayBindingV2('0', '', credential.cred, credential.token)
    if (!binding.bindingList.length) throw new Error('未找到绑定的明日方舟账号')

    pendingCredential.value = credential
    bindingList.value = binding.bindingList
    credentialDialog.value = false
    bindingDialog.value = true
  } catch (error) {
    actionError.value = getErrorMessage(error, '森空岛账号读取失败')
  } finally {
    isFetchingBindings.value = false
  }
}

/** 打开官网 Token 输入框 */
function openOfficialTokenDialog(): void {
  actionError.value = ''
  officialTokenInput.value = ''
  officialTokenDialog.value = true
}

/** 提交官网 Token：换取森空岛凭证后读取绑定账号列表 */
async function submitOfficialToken(): Promise<void> {
  if (isFetchingBindings.value) return
  isFetchingBindings.value = true
  actionError.value = ''
  try {
    const credential = await getSklandCredentialByOfficialToken(
      extractOfficialToken(officialTokenInput.value),
    )
    const binding = await getPlayBindingV2('0', '', credential.cred, credential.token)
    if (!binding.bindingList.length) throw new Error('未找到绑定的明日方舟账号')

    pendingCredential.value = credential
    bindingList.value = binding.bindingList
    officialTokenDialog.value = false
    bindingDialog.value = true
  } catch (error) {
    actionError.value = getErrorMessage(error, '官网 Token 处理失败')
  } finally {
    isFetchingBindings.value = false
  }
}

/** 停止二维码状态轮询 */
function stopQrPolling(): void {
  if (qrPollTimer !== null) {
    window.clearInterval(qrPollTimer)
    qrPollTimer = null
  }
}

/** 生成二维码并开始轮询扫码状态 */
async function startQrSession(): Promise<void> {
  stopQrPolling()
  qrImage.value = ''
  qrScanId.value = ''
  qrStatus.value = '正在生成二维码...'
  actionError.value = ''
  try {
    const qr = await createSklandQrCode()
    qrScanId.value = qr.scanId
    qrImage.value = await QRCode.toDataURL(qr.qrContent, {
      width: 240,
      margin: 1,
      errorCorrectionLevel: 'M',
    })
    qrStatus.value = '请使用森空岛 APP 扫描二维码并确认授权'
    qrPollTimer = window.setInterval(() => {
      void pollQrStatus()
    }, 2000)
  } catch (error) {
    qrStatus.value = ''
    actionError.value = getErrorMessage(error, '二维码生成失败，请稍后重试')
  }
}

/** 轮询一次扫码状态，扫码成功后进入账号选择 */
async function pollQrStatus(): Promise<void> {
  if (!qrScanId.value || isFetchingBindings.value) return
  isFetchingBindings.value = true
  try {
    const result = await checkSklandQrStatus(qrScanId.value)
    if (result.status === 0) {
      if (!result.cred || !result.token) throw new Error('扫码成功，但未获取到森空岛凭证')
      stopQrPolling()
      const credential: SklandCredential = { cred: result.cred, token: result.token }
      const binding = await getPlayBindingV2('0', '', credential.cred, credential.token)
      if (!binding.bindingList.length) throw new Error('未找到绑定的明日方舟账号')

      pendingCredential.value = credential
      bindingList.value = binding.bindingList
      qrDialog.value = false
      bindingDialog.value = true
    } else if (result.status === 102) {
      stopQrPolling()
      qrStatus.value = '二维码已过期，请重新生成'
    }
  } catch (error) {
    stopQrPolling()
    actionError.value = getErrorMessage(error, '二维码状态读取失败，请重新生成')
  } finally {
    isFetchingBindings.value = false
  }
}

/** 打开二维码对话框并开始一次新的扫码会话 */
function openQrDialog(): void {
  qrDialog.value = true
  void startQrSession()
}

/** 关闭二维码对话框，同时停止轮询 */
function closeQrDialog(): void {
  qrDialog.value = false
  stopQrPolling()
}

/** 关闭账号选择对话框并清空待用凭证 */
function closeBindingDialog(): void {
  if (isUploading.value) return
  bindingDialog.value = false
  pendingCredential.value = null
  bindingList.value = []
}

/** 关闭凭证输入对话框 */
function closeCredentialDialog(): void {
  credentialDialog.value = false
  credentialInput.value = ''
}

/** 关闭官网 Token 输入对话框 */
function closeOfficialTokenDialog(): void {
  officialTokenDialog.value = false
  officialTokenInput.value = ''
}

/**
 * 选定账号后拉取仓库数据并上传到当前用户
 * 上传成功后刷新账号列表并切换到该账号的干员视图
 * @param binding 选中的森空岛绑定账号
 */
async function uploadBinding(binding: SklandBinding): Promise<void> {
  const credential = pendingCredential.value
  if (!credential || isUploading.value) return

  isUploading.value = true
  actionError.value = ''
  try {
    const warehouse = await getWarehouseInfo(binding.uid, credential.cred, credential.token)
    if (!warehouse.operators.length) throw new Error('森空岛没有返回可识别的干员记录')

    const saved = await saveAkOperators({
      playerInfo: warehouse.playerInfo,
      operators: warehouse.operators,
    })

    bindingDialog.value = false
    pendingCredential.value = null
    bindingList.value = []
    createMessage({
      text: `已上传 ${warehouse.operators.length} 名干员（新增 ${saved.data.createdCount}、更新 ${saved.data.updatedCount}）`,
      type: 'success',
    })
    await loadAccounts()
    await viewAccount(binding.uid)
  } catch (error) {
    actionError.value = getErrorMessage(error, '干员数据上传失败')
  } finally {
    isUploading.value = false
  }
}

/** 手动重新拉取当前账号的干员数据 */
async function refreshOperators(): Promise<void> {
  if (!activeAkUid.value) return
  await viewAccount(activeAkUid.value, activeSource.value)
}

/** 切换到上一页 */
function goPrevPage(): void {
  if (currentPage.value > 1) currentPage.value -= 1
}

/** 切换到下一页 */
function goNextPage(): void {
  if (currentPage.value < totalPages.value) currentPage.value += 1
}

onBeforeUnmount(() => {
  stopQrPolling()
})

void loadAccounts()

// 干员静态表（名称 / 星级 / 职业）异步补全，失败时不影响表格本身的展示
void loadOperatorStaticData().then((data) => {
  operatorStatic.value = data
})
</script>

<template>
  <main class="common-data-page">
    <SecondaryPageHeader
      title-id="game-data-title"
      kicker="GAME DATA"
      title-a="游戏数据·明日方舟"
      description="把森空岛上的《明日方舟》账号数据导入到你的酸橙云账号，集中查看与更新。"
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

    <section class="operator-import-section" aria-labelledby="game-data-import-title">
      <div class="operator-section-heading">
        <div>
          <p class="operator-section-label">01 / IMPORT</p>
          <h2 id="game-data-import-title">导入你的游戏数据。</h2>
          <p>选择一种森空岛数据来源，选定账号后即可把干员数据导入到你的账号。</p>
        </div>
      </div>

      <div class="operator-import-grid">
        <article class="operator-import-card operator-import-card-skland">
          <div class="operator-card-top">
            <span>01</span>
            <span
              :class="[
                'operator-card-status',
                isFetchingBindings ? 'operator-card-status-loading' : 'operator-card-status-ready',
              ]"
            >
              {{ credentialCardStatus }}
            </span>
          </div>
          <div class="operator-import-icon">
            <v-icon icon="mdi-key-outline" size="28"></v-icon>
          </div>
          <h3>森空岛凭证</h3>
          <p>输入 cred,token 形式的森空岛凭证，先选择绑定的明日方舟账号，再导入干员数据。</p>
          <div class="operator-import-card-detail">
            <v-icon icon="mdi-shield-check-outline" size="15"></v-icon>
            <span>凭证仅用于本次读取，不会保存在本地</span>
          </div>
          <div class="operator-import-card-actions">
            <button
              class="operator-import-action"
              type="button"
              :disabled="isFetchingBindings"
              @click="openCredentialDialog"
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
          <p>粘贴明日方舟官网 account/info/hg 返回的完整 JSON，换取森空岛凭证后读取账号。</p>
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
          <button class="operator-import-action" type="button" @click="openQrDialog">
            <v-icon icon="mdi-qrcode" size="16"></v-icon>
            打开二维码
          </button>
        </article>
      </div>
    </section>

    <section class="operator-editor-section" aria-labelledby="game-data-accounts-title">
      <div class="operator-section-heading">
        <div>
          <p class="operator-section-label">02 / ACCOUNTS</p>
          <h2 id="game-data-accounts-title">已绑定的游戏账号。</h2>
          <p>首次导入会自动建立绑定，点击卡片即可查看该账号的干员数据。</p>
        </div>
        <div class="operator-editor-summary">
          <span>已绑定</span>
          <strong>{{ accounts.length }}</strong>
          <small>个账号</small>
        </div>
      </div>

      <div v-if="isLoadingAccounts" class="operator-editor-shell">
        <div class="operator-editor-empty">
          <v-progress-circular indeterminate color="primary" size="30"></v-progress-circular>
          <h3>正在读取账号。</h3>
          <p>正在向酸橙云查询你已经绑定的游戏账号。</p>
        </div>
      </div>

      <div v-else-if="!accounts.length" class="operator-editor-shell">
        <div class="operator-editor-empty">
          <v-icon icon="mdi-account-plus-outline" size="30"></v-icon>
          <h3>还没有绑定账号。</h3>
          <p>用上方的任意一种方式导入一次数据，即可创建绑定。</p>
        </div>
      </div>

      <div v-else class="operator-account-grid">
        <button
          v-for="account in accounts"
          :key="`${account.source || 'skland'}:${account.akUid}`"
          class="operator-account-card"
          :class="{
            'operator-account-card-active':
              account.akUid === activeAkUid && (account.source || 'skland') === activeSource,
          }"
          type="button"
          :disabled="isSavingManual || isLoadingOperators"
          @click="viewAccount(account.akUid, account.source || 'skland')"
        >
          <span class="operator-account-card-uid">{{
            account.source === 'manual' ? '手动上传' : account.akUid
          }}</span>
          <span class="operator-account-card-meta">
            <small>最近导入</small>
            <strong>{{ formatDateTime(account.updateTime) }}</strong>
          </span>
          <span class="operator-account-card-meta">
            <small>绑定时间</small>
            <strong>{{ formatDateTime(account.createTime) }}</strong>
          </span>
        </button>
      </div>
    </section>

    <section class="operator-editor-section" aria-labelledby="game-data-roster-title">
      <div class="operator-section-heading">
        <div>
          <p class="operator-section-label">03 / ROSTER</p>
          <h2 id="game-data-roster-title">干员数据。</h2>
          <p v-if="activeAkUid">
            当前来源：{{
              activeSource === 'manual' ? '手动上传' : `森空岛 · ${activeAkUid}`
            }}，列表包含完整图鉴与招募状态。
          </p>
          <p v-else>选择一个已绑定的账号即可查看其干员数据。</p>
        </div>
        <div class="operator-editor-summary">
          <span>共</span>
          <strong>{{ operatorTotal }}</strong>
          <small>名干员 · 已招募 {{ recruitedCount }}</small>
        </div>
      </div>

      <div class="operator-editor-shell">
        <div class="operator-editor-toolbar">
          <div class="operator-editor-toolbar-copy">
            <span class="operator-editor-label">当前账号</span>
            <strong>{{
              activeSource === 'manual' && activeAkUid
                ? '手动上传'
                : activeAkUid || (isManualEditing ? '手动录入' : '未选择账号')
            }}</strong>
            <small
              >筛选出 {{ filteredOperators.length }} 条记录 ·
              {{
                dirtyCount
                  ? `${dirtyCount} 名干员待上传`
                  : isManualEditing
                    ? '修改后请点击手动上传'
                    : '开启手动修改后可编辑'
              }}</small
            >
          </div>
          <div class="operator-editor-toolbar-controls">
            <v-text-field
              v-model="keyword"
              class="operator-search-field"
              label="搜索名称或 id"
              prepend-inner-icon="mdi-magnify"
              variant="outlined"
              density="compact"
              clearable
              :disabled="!activeAkUid && !isManualEditing"
              hide-details
            ></v-text-field>
            <div class="operator-editor-actions">
              <button
                class="operator-editor-secondary"
                type="button"
                :disabled="!activeAkUid || isLoadingOperators || isSavingManual"
                @click="refreshOperators"
              >
                <v-icon icon="mdi-refresh" size="16"></v-icon>
                {{ isLoadingOperators ? '读取中' : '重新读取' }}
              </button>
            </div>
          </div>
        </div>

        <div class="operator-roster-filters" role="group" aria-label="干员筛选">
          <div class="operator-filter-heading">
            <v-icon icon="mdi-filter-variant" size="18"></v-icon>
            <span>筛选</span>
          </div>
          <v-select
            v-model="rarityFilter"
            class="operator-filter-field operator-rarity-filter"
            label="星级"
            :items="[
              { title: '全部星级', value: 'all' },
              ...rarityOptions.map((value) => ({ title: `${value} 星`, value })),
            ]"
            variant="outlined"
            density="compact"
            :disabled="!activeAkUid && !isManualEditing"
            hide-details
          ></v-select>
          <v-select
            v-model="ownedFilter"
            class="operator-filter-field operator-owned-filter"
            label="是否招募"
            :items="[
              { title: '全部状态', value: 'all' },
              { title: '已招募', value: 1 },
              { title: '未招募', value: 0 },
            ]"
            variant="outlined"
            density="compact"
            :disabled="!activeAkUid && !isManualEditing"
            hide-details
          ></v-select>
          <v-select
            v-model="professionFilter"
            class="operator-filter-field operator-profession-filter"
            label="职业"
            :items="professionOptions"
            variant="outlined"
            density="compact"
            :disabled="!activeAkUid && !isManualEditing"
            hide-details
          ></v-select>
          <v-select
            v-model="yearFilter"
            class="operator-filter-field operator-year-filter"
            label="实装年份"
            :items="[
              { title: '全部年份', value: 'all' },
              ...yearOptions.map((value) => ({ title: `${value} 年`, value })),
            ]"
            variant="outlined"
            density="compact"
            :disabled="!activeAkUid && !isManualEditing"
            hide-details
          ></v-select>
          <button
            class="operator-editor-secondary operator-filter-reset"
            type="button"
            :disabled="!hasActiveFilters || (!activeAkUid && !isManualEditing)"
            @click="resetRosterFilters"
          >
            重置筛选
          </button>
        </div>

        <div class="operator-manual-toolbar">
          <v-switch
            v-model="isManualEditing"
            class="operator-manual-switch"
            label="手动修改"
            color="primary"
            density="compact"
            :disabled="!canStartManualEditing"
            hide-details
            inset
          ></v-switch>
          <span class="operator-manual-status" aria-live="polite">
            {{ dirtyCount ? `${dirtyCount} 名干员的修改尚未上传` : '开启后可修改练度和招募状态' }}
          </span>
          <button
            class="operator-editor-primary"
            type="button"
            :disabled="!canEditOperators || !dirtyCount"
            @click="uploadManualOperators"
          >
            <v-icon
              :icon="isSavingManual ? 'mdi-loading' : 'mdi-cloud-upload-outline'"
              size="16"
            ></v-icon>
            {{ isSavingManual ? '上传中…' : '手动上传' }}
          </button>
        </div>

        <div v-if="isLoadingOperators" class="operator-editor-empty">
          <v-progress-circular indeterminate color="primary" size="30"></v-progress-circular>
          <h3>正在读取干员数据。</h3>
          <p>正在向酸橙云查询该账号下的干员记录。</p>
        </div>

        <div v-else-if="sourceLoadError" class="operator-editor-empty">
          <h3>干员数据读取失败。</h3>
          <p>请点击重新读取，成功后即可开启手动修改。</p>
        </div>

        <div v-else-if="!activeAkUid && !isManualEditing" class="operator-editor-empty">
          <v-icon icon="mdi-account-arrow-right-outline" size="30"></v-icon>
          <h3>尚未选择账号。</h3>
          <p>在上方「已绑定的游戏账号」中点击一张卡片即可查看干员数据。</p>
        </div>

        <div v-else-if="!filteredOperators.length" class="operator-editor-empty">
          <v-icon icon="mdi-filter-off-outline" size="30"></v-icon>
          <h3>{{ operatorTotal ? '没有匹配的干员。' : '该账号还没有干员数据。' }}</h3>
          <p>
            {{
              operatorTotal
                ? '调整搜索关键词或筛选条件后再试。'
                : '用上方的森空岛方式导入一次数据即可。'
            }}
          </p>
        </div>

        <template v-else>
          <div class="operator-roster-table-wrap">
            <table class="operator-roster-table">
              <thead>
                <tr>
                  <th scope="col">干员</th>
                  <th scope="col">是否招募</th>
                  <th scope="col">星级</th>
                  <th scope="col">等级</th>
                  <th scope="col">精英</th>
                  <th scope="col">潜能</th>
                  <th scope="col">通用技能</th>
                  <th scope="col">一技能</th>
                  <th scope="col">二技能</th>
                  <th scope="col">三技能</th>
                  <th scope="col">模组 X</th>
                  <th scope="col">模组 Y</th>
                  <th scope="col">模组 D</th>
                  <th scope="col">模组 A</th>
                  <th scope="col">模组 B</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="operator in pageOperators" :key="operator.id">
                  <td class="operator-roster-operator">
                    <div class="operator-roster-operator-inner">
                      <img
                        class="operator-avatar-img operator-avatar-img--bordered"
                        :src="getOperatorAvatarUrl(operator.id)"
                        :alt="getOperatorDisplayName(operatorStatic, operator.id)"
                        :style="
                          getOperatorAvatarStyle({
                            size: 48,
                            mobileSize: 38,
                            rarity: operatorRarity(operator),
                            bordered: true,
                          })
                        "
                        loading="lazy"
                        decoding="async"
                        @error="hideBrokenAvatar"
                      />
                      <div class="operator-roster-operator-copy">
                        <span class="operator-roster-name" :title="operator.id">
                          {{ getOperatorDisplayName(operatorStatic, operator.id) }}
                          <em
                            v-if="operator.dirty || operator.manual"
                            class="operator-roster-manual-tag"
                            >{{ operator.dirty ? '待上传' : '手动' }}</em
                          >
                        </span>
                        <span class="operator-roster-meta">
                          {{ getOperatorProfessionText(operatorStatic, operator.id) || '未知职业' }}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <button
                      type="button"
                      :class="[
                        'operator-roster-owned',
                        operator.owned ? 'operator-roster-owned--yes' : 'operator-roster-owned--no',
                      ]"
                      :disabled="!canEditOperators"
                      :aria-label="`${getOperatorDisplayName(operatorStatic, operator.id)}：${operator.owned ? '已招募' : '未招募'}`"
                      :aria-pressed="operator.owned === 1"
                      @click="updateOperatorField(operator, 'owned', operator.owned ? 0 : 1)"
                    >
                      {{ operator.owned ? '已招募' : '未招募' }}
                    </button>
                  </td>
                  <td>{{ operatorRarity(operator) }}</td>
                  <td>
                    <OperatorCellEditor
                      kind="level"
                      label="修改等级"
                      :value="operator.level"
                      :min="0"
                      :max="90"
                      :disabled="!canEditOperators"
                      @commit="updateOperatorField(operator, 'level', $event)"
                    />
                  </td>
                  <td>
                    <OperatorCellEditor
                      kind="elite"
                      label="修改精英化"
                      :value="operator.evolvePhase"
                      :min="0"
                      :max="2"
                      :disabled="!canEditOperators"
                      @commit="updateOperatorField(operator, 'evolvePhase', $event)"
                    />
                  </td>
                  <td>{{ operator.potentialRank }}</td>
                  <td>
                    <OperatorCellEditor
                      kind="main-skill"
                      label="修改通用技能等级"
                      :value="operator.mainSkillLevel"
                      :min="1"
                      :max="7"
                      :disabled="!canEditOperators"
                      @commit="updateOperatorField(operator, 'mainSkillLevel', $event)"
                    />
                  </td>
                  <td>
                    <div class="operator-roster-progress">
                      <OperatorCellEditor
                        v-if="skillIconUrl(operator.id, 0)"
                        variant="overlay"
                        kind="skill"
                        label="修改技能1专精"
                        :value="operator.skill1"
                        :min="0"
                        :max="3"
                        :disabled="!canEditOperators"
                        @commit="updateOperatorField(operator, 'skill1', $event)"
                      >
                        <span
                          class="operator-roster-progress-icon"
                          :title="skillTitle(operator.id, 0, operator.skill1)"
                        >
                          <img
                            class="operator-roster-skill-image"
                            :src="skillIconUrl(operator.id, 0)"
                            alt=""
                            loading="lazy"
                          />
                          <img
                            v-if="operator.skill1 > 0"
                            class="operator-roster-rank-badge"
                            :src="rankBadgeUrl('skill', operator.skill1)"
                            alt=""
                          />
                        </span>
                      </OperatorCellEditor>
                      <span v-else class="operator-roster-empty">—</span>
                    </div>
                  </td>
                  <td>
                    <div class="operator-roster-progress">
                      <OperatorCellEditor
                        v-if="skillIconUrl(operator.id, 1)"
                        variant="overlay"
                        kind="skill"
                        label="修改技能2专精"
                        :value="operator.skill2"
                        :min="0"
                        :max="3"
                        :disabled="!canEditOperators"
                        @commit="updateOperatorField(operator, 'skill2', $event)"
                      >
                        <span
                          class="operator-roster-progress-icon"
                          :title="skillTitle(operator.id, 1, operator.skill2)"
                        >
                          <img
                            class="operator-roster-skill-image"
                            :src="skillIconUrl(operator.id, 1)"
                            alt=""
                            loading="lazy"
                          />
                          <img
                            v-if="operator.skill2 > 0"
                            class="operator-roster-rank-badge"
                            :src="rankBadgeUrl('skill', operator.skill2)"
                            alt=""
                          />
                        </span>
                      </OperatorCellEditor>
                      <span v-else class="operator-roster-empty">—</span>
                    </div>
                  </td>
                  <td>
                    <div class="operator-roster-progress">
                      <OperatorCellEditor
                        v-if="skillIconUrl(operator.id, 2)"
                        variant="overlay"
                        kind="skill"
                        label="修改技能3专精"
                        :value="operator.skill3"
                        :min="0"
                        :max="3"
                        :disabled="!canEditOperators"
                        @commit="updateOperatorField(operator, 'skill3', $event)"
                      >
                        <span
                          class="operator-roster-progress-icon"
                          :title="skillTitle(operator.id, 2, operator.skill3)"
                        >
                          <img
                            class="operator-roster-skill-image"
                            :src="skillIconUrl(operator.id, 2)"
                            alt=""
                            loading="lazy"
                          />
                          <img
                            v-if="operator.skill3 > 0"
                            class="operator-roster-rank-badge"
                            :src="rankBadgeUrl('skill', operator.skill3)"
                            alt=""
                          />
                        </span>
                      </OperatorCellEditor>
                      <span v-else class="operator-roster-empty">—</span>
                    </div>
                  </td>
                  <td>
                    <div class="operator-roster-progress">
                      <OperatorCellEditor
                        v-if="equipIconUrl(operator.id, 'X')"
                        variant="overlay"
                        kind="module"
                        label="修改模组X等级"
                        :value="operator.equipX"
                        :min="0"
                        :max="3"
                        :disabled="!canEditOperators"
                        @commit="updateOperatorField(operator, 'equipX', $event)"
                      >
                        <span
                          class="operator-roster-progress-icon operator-roster-progress-icon--mod"
                          :title="equipTitle(operator.id, 'X', operator.equipX)"
                        >
                          <img
                            class="operator-roster-equip-image"
                            :src="equipIconUrl(operator.id, 'X')"
                            alt=""
                            loading="lazy"
                          />
                          <span class="operator-roster-equip-label">{{
                            equipLabel(operator.id, 'X')
                          }}</span>
                          <img
                            v-if="operator.equipX > 0"
                            class="operator-roster-rank-badge"
                            :src="rankBadgeUrl('mod', operator.equipX)"
                            alt=""
                          />
                        </span>
                      </OperatorCellEditor>
                      <span v-else class="operator-roster-empty">—</span>
                    </div>
                  </td>
                  <td>
                    <div class="operator-roster-progress">
                      <OperatorCellEditor
                        v-if="equipIconUrl(operator.id, 'Y')"
                        variant="overlay"
                        kind="module"
                        label="修改模组Y等级"
                        :value="operator.equipY"
                        :min="0"
                        :max="3"
                        :disabled="!canEditOperators"
                        @commit="updateOperatorField(operator, 'equipY', $event)"
                      >
                        <span
                          class="operator-roster-progress-icon operator-roster-progress-icon--mod"
                          :title="equipTitle(operator.id, 'Y', operator.equipY)"
                        >
                          <img
                            class="operator-roster-equip-image"
                            :src="equipIconUrl(operator.id, 'Y')"
                            alt=""
                            loading="lazy"
                          />
                          <span class="operator-roster-equip-label">{{
                            equipLabel(operator.id, 'Y')
                          }}</span>
                          <img
                            v-if="operator.equipY > 0"
                            class="operator-roster-rank-badge"
                            :src="rankBadgeUrl('mod', operator.equipY)"
                            alt=""
                          />
                        </span>
                      </OperatorCellEditor>
                      <span v-else class="operator-roster-empty">—</span>
                    </div>
                  </td>
                  <td>
                    <div class="operator-roster-progress">
                      <OperatorCellEditor
                        v-if="equipIconUrl(operator.id, 'D')"
                        variant="overlay"
                        kind="module"
                        label="修改模组D等级"
                        :value="operator.equipD"
                        :min="0"
                        :max="3"
                        :disabled="!canEditOperators"
                        @commit="updateOperatorField(operator, 'equipD', $event)"
                      >
                        <span
                          class="operator-roster-progress-icon operator-roster-progress-icon--mod"
                          :title="equipTitle(operator.id, 'D', operator.equipD)"
                        >
                          <img
                            class="operator-roster-equip-image"
                            :src="equipIconUrl(operator.id, 'D')"
                            alt=""
                            loading="lazy"
                          />
                          <span class="operator-roster-equip-label">{{
                            equipLabel(operator.id, 'D')
                          }}</span>
                          <img
                            v-if="operator.equipD > 0"
                            class="operator-roster-rank-badge"
                            :src="rankBadgeUrl('mod', operator.equipD)"
                            alt=""
                          />
                        </span>
                      </OperatorCellEditor>
                      <span v-else class="operator-roster-empty">—</span>
                    </div>
                  </td>
                  <td>
                    <div class="operator-roster-progress">
                      <OperatorCellEditor
                        v-if="equipIconUrl(operator.id, 'A')"
                        variant="overlay"
                        kind="module"
                        label="修改模组A等级"
                        :value="operator.equipA"
                        :min="0"
                        :max="3"
                        :disabled="!canEditOperators"
                        @commit="updateOperatorField(operator, 'equipA', $event)"
                      >
                        <span
                          class="operator-roster-progress-icon operator-roster-progress-icon--mod"
                          :title="equipTitle(operator.id, 'A', operator.equipA)"
                        >
                          <img
                            class="operator-roster-equip-image"
                            :src="equipIconUrl(operator.id, 'A')"
                            alt=""
                            loading="lazy"
                          />
                          <span class="operator-roster-equip-label">{{
                            equipLabel(operator.id, 'A')
                          }}</span>
                          <img
                            v-if="operator.equipA > 0"
                            class="operator-roster-rank-badge"
                            :src="rankBadgeUrl('mod', operator.equipA)"
                            alt=""
                          />
                        </span>
                      </OperatorCellEditor>
                      <span v-else class="operator-roster-empty">—</span>
                    </div>
                  </td>
                  <td>
                    <div class="operator-roster-progress">
                      <OperatorCellEditor
                        v-if="equipIconUrl(operator.id, 'B')"
                        variant="overlay"
                        kind="module"
                        label="修改模组B等级"
                        :value="operator.equipB"
                        :min="0"
                        :max="3"
                        :disabled="!canEditOperators"
                        @commit="updateOperatorField(operator, 'equipB', $event)"
                      >
                        <span
                          class="operator-roster-progress-icon operator-roster-progress-icon--mod"
                          :title="equipTitle(operator.id, 'B', operator.equipB)"
                        >
                          <img
                            class="operator-roster-equip-image"
                            :src="equipIconUrl(operator.id, 'B')"
                            alt=""
                            loading="lazy"
                          />
                          <span class="operator-roster-equip-label">{{
                            equipLabel(operator.id, 'B')
                          }}</span>
                          <img
                            v-if="operator.equipB > 0"
                            class="operator-roster-rank-badge"
                            :src="rankBadgeUrl('mod', operator.equipB)"
                            alt=""
                          />
                        </span>
                      </OperatorCellEditor>
                      <span v-else class="operator-roster-empty">—</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p class="operator-roster-hint">
            修改先保留在当前页面，关闭手动修改开关后仍会保留；点击「手动上传」仅提交修改过的干员（包含取消招募），筛选和分页不会影响上传范围。
          </p>

          <div class="operator-roster-pagination">
            <span>第 {{ currentPage }} / {{ totalPages }} 页</span>
            <button
              class="operator-editor-secondary"
              type="button"
              :disabled="currentPage <= 1"
              @click="goPrevPage"
            >
              上一页
            </button>
            <button
              class="operator-editor-secondary"
              type="button"
              :disabled="currentPage >= totalPages"
              @click="goNextPage"
            >
              下一页
            </button>
          </div>
        </template>
      </div>

      <p class="operator-editor-note">
        游戏数据按账号维度保存在酸橙云，重复导入同一账号只会更新变化的字段。
      </p>
    </section>

    <footer class="common-data-footer">
      <span>酸橙云 · 让工具数据跟着用户走</span>
      <RouterLink to="/projects">
        查看工具授权
        <v-icon icon="mdi-arrow-top-right" size="16"></v-icon>
      </RouterLink>
    </footer>

    <v-dialog v-model="credentialDialog" max-width="560">
      <v-card class="operator-token-dialog">
        <v-card-title>输入森空岛凭证</v-card-title>
        <v-card-text>
          <p class="operator-token-dialog-copy">粘贴森空岛凭证，格式为 cred,token。</p>
          <v-textarea
            v-model="credentialInput"
            class="operator-token-input"
            label="森空岛凭证"
            rows="3"
            autocomplete="off"
            variant="outlined"
            density="comfortable"
            hide-details
            placeholder="cred,token"
          ></v-textarea>
          <p v-if="actionError" class="operator-import-error">{{ actionError }}</p>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="closeCredentialDialog">取消</v-btn>
          <v-btn color="primary" :loading="isFetchingBindings" @click="submitCredential">
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
            rows="6"
            autocomplete="off"
            variant="outlined"
            density="comfortable"
            hide-details
          ></v-textarea>
          <p v-if="actionError" class="operator-import-error">{{ actionError }}</p>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="closeOfficialTokenDialog">取消</v-btn>
          <v-btn color="primary" :loading="isFetchingBindings" @click="submitOfficialToken">
            读取账号
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog :model-value="qrDialog" max-width="460" @update:model-value="closeQrDialog">
      <v-card class="operator-qr-dialog">
        <v-card-title>森空岛扫码登录</v-card-title>
        <v-card-text class="operator-qr-dialog-body">
          <div v-if="qrImage" class="operator-qr-image-wrap">
            <img class="operator-qr-image" :src="qrImage" alt="森空岛登录二维码" />
          </div>
          <v-progress-circular v-else indeterminate color="primary"></v-progress-circular>
          <p class="operator-qr-status">{{ qrStatus || '二维码暂不可用' }}</p>
          <p v-if="actionError" class="operator-import-error">{{ actionError }}</p>
        </v-card-text>
        <v-card-actions>
          <v-btn variant="text" @click="startQrSession">
            <v-icon icon="mdi-refresh" start></v-icon>
            重新生成
          </v-btn>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="closeQrDialog">关闭</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog :model-value="bindingDialog" max-width="560" @update:model-value="closeBindingDialog">
      <v-card class="operator-account-dialog">
        <v-card-title>选择要导入的账号</v-card-title>
        <v-card-text>
          <p class="operator-token-dialog-copy">
            选定后会把该账号的干员数据上传到你的酸橙云账号，同名干员按最新数据更新。
          </p>
          <div class="operator-account-list">
            <button
              v-for="binding in bindingList"
              :key="binding.uid"
              class="operator-account-option"
              type="button"
              :disabled="isUploading"
              @click="uploadBinding(binding)"
            >
              <span class="operator-account-option-copy">
                <strong>{{ binding.nickName || binding.uid }}</strong>
                <small>{{ binding.channelName }} · UID {{ binding.uid }}</small>
              </span>
              <v-icon :icon="isUploading ? 'mdi-loading' : 'mdi-arrow-right'" size="18"></v-icon>
            </button>
          </div>
          <p v-if="actionError" class="operator-import-error">{{ actionError }}</p>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" :disabled="isUploading" @click="closeBindingDialog">取消</v-btn>
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

.operator-import-action:focus-visible,
.operator-editor-primary:focus-visible,
.operator-editor-secondary:focus-visible,
.operator-account-card:focus-visible,
.operator-account-option:focus-visible,
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

/* ---- 页头纹理（与通用数据维护页保持同一套几何图案）---- */
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

/* ---- 区块标题 ---- */
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

/* ---- 数据来源卡片 ---- */
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

/* ---- 通用按钮 ---- */
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

.operator-import-action:hover,
.operator-editor-primary:hover,
.operator-editor-secondary:hover {
  filter: brightness(0.95);
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

.operator-import-error {
  margin: 8px 0 0 !important;
  color: #c34b5f !important;
  font-size: 11px !important;
  line-height: 1.5 !important;
}

/* ---- 计数 ---- */
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

/* ---- 已绑定账号卡片 ---- */
.operator-account-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 16px;
  padding-top: 22px;
}

.operator-account-card {
  display: grid;
  gap: 10px;
  padding: 18px 20px 20px;
  border: 1px solid var(--site-line);
  border-top: 5px solid var(--site-accent);
  border-radius: 8px;
  background: var(--site-surface);
  cursor: pointer;
  text-align: left;
}

.operator-account-card:hover {
  border-color: var(--site-accent);
}

.operator-account-card-active {
  border-top-color: var(--site-pink);
  background: var(--site-accent-soft);
}

.operator-account-card-uid {
  overflow-wrap: anywhere;
  color: var(--site-ink);
  font-size: 20px;
  font-weight: 750;
}

.operator-account-card-meta {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  color: var(--site-muted);
  font-size: 11px;
}

.operator-account-card-meta strong {
  color: var(--site-ink);
  font-size: 11px;
  font-weight: 750;
}

/* ---- 编辑区外壳与工具条 ---- */
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

.operator-editor-toolbar-copy {
  display: grid;
  gap: 4px;
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
  overflow-wrap: anywhere;
  color: var(--site-ink);
  font-size: 14px;
  font-weight: 750;
}

.operator-editor-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.operator-manual-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  padding: 12px 22px;
  border-top: 1px solid var(--site-line);
  border-bottom: 1px solid var(--site-line);
}

.operator-manual-switch {
  flex: 0 0 auto;
}

.operator-manual-status {
  flex: 1 1 180px;
  color: var(--site-muted);
  font-size: 12px;
}

.operator-roster-owned {
  min-width: 48px;
  padding: 3px 6px;
  border: 0;
  border-radius: 4px;
  color: #fff;
  cursor: pointer;
  font: inherit;
  font-size: 11px;
  line-height: 16px;
  font-weight: 700;
  white-space: nowrap;
}

.operator-roster-owned--yes {
  background: #1976d2;
}

.operator-roster-owned--no {
  background: #c94153;
}

.operator-roster-owned:hover:not(:disabled) {
  filter: brightness(1.1);
}

.operator-roster-owned:focus-visible {
  outline: 2px solid var(--site-accent);
  outline-offset: 3px;
}

.operator-roster-owned:disabled {
  cursor: default;
}

.operator-editor-toolbar-controls {
  display: grid;
  grid-template-columns: minmax(190px, 1fr) auto;
  align-items: center;
  justify-content: end;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.operator-search-field,
.operator-filter-field {
  min-width: 0;
  margin: 0;
}

.operator-roster-filters {
  display: grid;
  grid-template-columns: auto repeat(4, minmax(100px, 1fr)) auto;
  align-items: center;
  gap: 12px;
  padding: 14px 22px;
  border-bottom: 1px solid var(--site-line);
}

.operator-filter-heading {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--site-muted);
  font-size: 12px;
  font-weight: 700;
}

/* ---- 干员表格 ---- */
.operator-roster-table-wrap {
  overflow-x: auto;
}

.operator-roster-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.operator-roster-table th,
.operator-roster-table td {
  padding: 9px 12px;
  border-bottom: 1px solid var(--site-line);
  text-align: left;
  white-space: nowrap;
}

.operator-roster-table th {
  background: rgb(234 247 247 / 0.5);
  color: var(--site-muted);
  font-size: 10px;
  font-weight: 750;
  letter-spacing: 0.1em;
}

.operator-roster-table tbody tr:hover {
  background: rgb(213 242 243 / 0.35);
}

.operator-roster-table tbody tr:last-child td {
  border-bottom: none;
}

.operator-roster-operator-inner {
  display: flex;
  align-items: center;
  gap: 10px;
}

.operator-roster-operator-copy {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.operator-roster-name {
  color: var(--site-ink);
  font-size: 13px;
  font-weight: 750;
}

.operator-roster-meta {
  color: var(--site-muted);
  font-size: 11px;
  font-weight: 700;
}

/* 与参考干员列表一致：技能方图、模组小图及类型名、左上角等级角标。 */
.operator-roster-progress {
  display: flex;
  align-items: center;
  gap: 6px;
}

.operator-roster-progress-icon {
  position: relative;
  display: inline-flex;
  width: 40px;
  height: 40px;
  flex: none;
  box-sizing: border-box;
  border-radius: 4px;
}

.operator-roster-skill-image {
  display: block;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  border: 1px solid rgb(72 78 88 / 58%);
  border-radius: 4px;
  background: var(--site-paper);
  object-fit: cover;
}

.operator-roster-progress-icon--mod {
  border: 1px solid rgb(72 78 88 / 58%);
  background: var(--site-paper);
}

.operator-roster-equip-image {
  position: absolute;
  top: 1px;
  left: 7px;
  width: 24px;
  height: 24px;
  object-fit: contain;
  filter: drop-shadow(1px 1px 1px #000);
}

.operator-roster-equip-label {
  position: absolute;
  top: 21px;
  left: 0;
  width: 100%;
  color: var(--site-ink);
  font-size: 10px;
  line-height: 16px;
  text-align: center;
  white-space: nowrap;
}

/* 该槽位没有技能 / 模组时的占位 */
.operator-roster-empty {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  color: var(--site-muted);
  font-size: 12px;
}

/* 技能角标 16px；模组角标 18px，均使用本地 SVG。 */
.operator-roster-rank-badge {
  position: absolute;
  z-index: 1;
  top: -2px;
  left: -2px;
  width: 16px;
  height: 16px;
  border: 0;
  background: transparent;
  box-shadow: 1px 1px 2px #fff;
  object-fit: contain;
  pointer-events: none;
}

.operator-roster-progress-icon--mod .operator-roster-rank-badge {
  top: -3px;
  left: -3px;
  width: 18px;
  height: 18px;
  box-shadow: none;
}

@media (max-width: 600px) {
  .operator-roster-progress-icon,
  .operator-roster-empty {
    width: 30px;
    height: 30px;
  }

  .operator-roster-equip-image {
    left: 4px;
    width: 20px;
    height: 20px;
  }

  .operator-roster-equip-label {
    top: 16px;
    font-size: 6px;
    line-height: 10px;
  }

  .operator-roster-rank-badge,
  .operator-roster-progress-icon--mod .operator-roster-rank-badge {
    top: -1px;
    left: -1px;
    width: 14px;
    height: 14px;
  }
}

/* 行内「手动」标记：表示该行练度来自手动修改版 */
.operator-roster-manual-tag {
  margin-left: 5px;
  padding: 0 4px;
  border-radius: 3px;
  background: var(--site-accent-soft);
  color: var(--site-accent);
  font-size: 9px;
  font-style: normal;
  font-weight: 750;
  vertical-align: 1px;
}

.operator-roster-hint {
  margin: 10px 0 0;
  color: var(--site-muted);
  font-size: 11px;
  line-height: 1.6;
}

.operator-roster-pagination {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 22px 18px;
  color: var(--site-muted);
  font-size: 11px;
}

.operator-roster-pagination span {
  margin-right: 4px;
}

/* ---- 空态 ---- */
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
  max-width: 420px;
  margin: 0 0 10px;
  font-size: 13px;
}

.operator-editor-note {
  margin: 12px 0 0;
  color: var(--site-muted);
  font-size: 11px;
  line-height: 1.6;
}

/* ---- 页脚 ---- */
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

/* ---- 对话框 ---- */
.operator-token-dialog,
.operator-account-dialog,
.operator-qr-dialog {
  border: 1px solid var(--site-ink);
  border-radius: 8px !important;
  background: var(--site-surface) !important;
}

.operator-token-dialog-copy {
  margin: 0 0 18px;
  color: var(--site-muted);
  font-size: 12px;
  line-height: 1.7;
}

.operator-token-input {
  margin-top: 14px;
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
  align-content: center;
  gap: 12px;
  min-height: 310px;
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

  .operator-search-field {
    grid-column: 1 / -1;
  }

  .operator-roster-filters {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .operator-filter-heading {
    grid-column: 1;
  }

  .operator-filter-reset {
    grid-column: 2;
    grid-row: 1;
    justify-self: end;
  }

  .operator-editor-actions {
    justify-content: flex-start;
  }
}

@media (max-width: 560px) {
  .common-data-page {
    width: calc(100% - 32px);
    padding-top: 24px;
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

  .operator-search-field {
    grid-column: auto;
  }

  .operator-roster-filters {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    padding: 14px 18px;
  }

  .operator-filter-heading {
    grid-column: 1;
  }

  .operator-filter-reset {
    grid-column: 2;
  }

  .operator-filter-field {
    grid-column: 1 / -1;
  }

  .operator-editor-summary {
    padding-top: 0;
  }

  .operator-roster-pagination {
    justify-content: flex-start;
    flex-wrap: wrap;
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
