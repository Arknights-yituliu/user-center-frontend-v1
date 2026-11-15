<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import * as QRCode from 'qrcode'
import SecondaryPageHeader from '../components/SecondaryPageHeader.vue'
import EndfieldCardDetail from '../components/EndfieldCardDetail.vue'
import { extractOfficialToken, type SklandCredential } from '../api/skland-operator-api'
import {
  checkEndfieldQrStatus,
  createEndfieldQrCode,
  getEndfieldCardDetail,
  getEndfieldCredential,
  getEndfieldCredentialByOfficialToken,
  getEndfieldRoles,
  isEndfieldCredentialExpired,
  type EndfieldRole,
} from '../api/skland-endfield-api'
import {
  getEfPlayerData,
  listEfAccounts,
  saveEfPlayerData,
  type EfAccount,
  type EfPlayerData,
} from '../api/user-center/ef-account-api'
import { getUcToken } from '../api/user-center/request'

type ImportMethod = 'credential' | 'official' | 'qr'
const methods: Array<{ key: ImportMethod; icon: string; title: string; description: string }> = [
  {
    key: 'credential',
    icon: 'mdi-key-outline',
    title: '森空岛凭证',
    description: '输入 cred 或 cred,token，读取已绑定的终末地角色。',
  },
  {
    key: 'official',
    icon: 'mdi-shield-key-outline',
    title: '官网 Token',
    description: '粘贴鹰角通行证 Token，换取森空岛凭证后读取角色。',
  },
  {
    key: 'qr',
    icon: 'mdi-qrcode-scan',
    title: '森空岛扫码登录',
    description: '使用森空岛 APP 扫码并确认授权，自动读取角色。',
  },
]
const method = ref<ImportMethod>('credential')
const credentialInput = ref('')
const officialInput = ref('')
const credential = ref<SklandCredential | null>(null)
const roles = ref<EndfieldRole[]>([])
const rolesLoading = ref(false)
const importing = ref(false)
const importingRoleKey = ref('')
const importError = ref('')
const notice = ref('')
const qrImage = ref('')
const qrStatus = ref('')
const qrLoading = ref(false)
const accounts = ref<EfAccount[]>([])
const accountsLoading = ref(false)
const selectedCloudKey = ref('')
const cloudData = ref<EfPlayerData | null>(null)
const cloudLoading = ref(false)
const cloudError = ref('')
const loggedIn = ref(Boolean(getUcToken()))
const busy = computed(() => rolesLoading.value || importing.value)
let disposed = false
let credentialVersion = 0
let cloudVersion = 0
let qrVersion = 0
let qrTimer: ReturnType<typeof setTimeout> | undefined

function accountKey(account: { roleId: string; serverId: string }): string {
  return JSON.stringify([account.serverId, account.roleId])
}

function errorMessage(error: unknown, fallback: string): string {
  const payload = error as { code?: number; msg?: string; message?: string }
  if (payload?.code === 30006) return '导入过于频繁，请稍后重试。'
  if (payload?.code === 80001 || payload?.code === 80002) {
    loggedIn.value = false
    accounts.value = []
    selectedCloudKey.value = ''
    cloudData.value = null
    cloudVersion += 1
    return '酸橙云登录已失效，请重新登录后导入。'
  }
  if (isEndfieldCredentialExpired(error)) {
    resetCredential()
    return '森空岛凭证已过期，请重新获取凭证。'
  }
  return payload?.msg || payload?.message || fallback
}

function formatTime(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false })
}

function stopQr(): void {
  qrVersion += 1
  if (qrTimer !== undefined) clearTimeout(qrTimer)
  qrTimer = undefined
  qrLoading.value = false
}

function resetCredential(): void {
  credentialVersion += 1
  stopQr()
  credential.value = null
  credentialInput.value = ''
  officialInput.value = ''
  roles.value = []
  rolesLoading.value = false
  importError.value = ''
  notice.value = ''
  qrImage.value = ''
  qrStatus.value = ''
}

async function loadCredential(resolve: () => Promise<SklandCredential>): Promise<void> {
  if (busy.value) return
  resetCredentialStateForRequest()
  const version = ++credentialVersion
  rolesLoading.value = true
  try {
    const value = await resolve()
    if (disposed || version !== credentialVersion) return
    const result = await getEndfieldRoles(value)
    if (disposed || version !== credentialVersion) return
    credential.value = value
    roles.value = result
    credentialInput.value = ''
    officialInput.value = ''
    if (!result.length) importError.value = '未找到绑定的终末地角色，请先在森空岛绑定游戏账号。'
  } catch (error) {
    if (!disposed && version === credentialVersion)
      importError.value = errorMessage(error, '读取角色失败，请重试。')
  } finally {
    if (!disposed && version === credentialVersion) rolesLoading.value = false
  }
}

function resetCredentialStateForRequest(): void {
  credential.value = null
  roles.value = []
  importError.value = ''
  notice.value = ''
}

function submitCredential(): void {
  const input = credentialInput.value
  void loadCredential(() => getEndfieldCredential(input))
}

function submitOfficialToken(): void {
  const input = officialInput.value.trim()
  void loadCredential(() =>
    getEndfieldCredentialByOfficialToken(
      input.startsWith('{') ? extractOfficialToken(input) : input,
    ),
  )
}

async function startQr(): Promise<void> {
  if (busy.value) return
  stopQr()
  const version = qrVersion
  qrImage.value = ''
  importError.value = ''
  qrStatus.value = '正在生成二维码…'
  qrLoading.value = true
  try {
    const session = await createEndfieldQrCode()
    const image = await QRCode.toDataURL(session.qrContent, { width: 240, margin: 1 })
    if (disposed || version !== qrVersion) return
    qrImage.value = image
    qrStatus.value = '请使用森空岛 APP 扫码，并在手机上确认授权。'
    qrLoading.value = false
    qrTimer = setTimeout(() => void pollQr(session.scanId, version), 2000)
  } catch (error) {
    if (disposed || version !== qrVersion) return
    qrStatus.value = ''
    importError.value = errorMessage(error, '二维码生成失败，请重试。')
  } finally {
    if (!disposed && version === qrVersion) qrLoading.value = false
  }
}

async function pollQr(scanId: string, version: number): Promise<void> {
  try {
    const result = await checkEndfieldQrStatus(scanId)
    if (disposed || version !== qrVersion) return
    if (result.status === 0) {
      if (!result.cred || !result.token)
        throw new Error('扫码成功，但未获取到有效凭证，请重新扫码。')
      stopQr()
      const value = { cred: result.cred, token: result.token }
      qrImage.value = ''
      qrStatus.value = '扫码成功。'
      await loadCredential(async () => value)
      return
    }
    if (result.status === 102) {
      stopQr()
      qrStatus.value = '二维码已过期，请重新生成。'
      return
    }
    if (result.status !== 100 && result.status !== 101)
      throw new Error('扫码状态异常，请重新生成二维码。')
    qrStatus.value =
      result.status === 101 ? '已扫码，请在手机上确认授权。' : '请使用森空岛 APP 扫码。'
    qrTimer = setTimeout(() => void pollQr(scanId, version), 2000)
  } catch (error) {
    if (disposed || version !== qrVersion) return
    stopQr()
    importError.value = errorMessage(error, '扫码状态读取失败，请重试。')
  }
}

async function loadAccounts(preferredKey = selectedCloudKey.value): Promise<void> {
  if (!loggedIn.value) return
  accountsLoading.value = true
  cloudError.value = ''
  try {
    const result = await listEfAccounts()
    if (disposed) return
    accounts.value = result
    const nextKey = result.some((account) => accountKey(account) === preferredKey)
      ? preferredKey
      : result[0]
        ? accountKey(result[0])
        : ''
    if (nextKey === selectedCloudKey.value) await loadCloudDetail()
    else selectedCloudKey.value = nextKey
  } catch (error) {
    if (!disposed) cloudError.value = errorMessage(error, '云端账号读取失败，请重试。')
  } finally {
    if (!disposed) accountsLoading.value = false
  }
}

async function loadCloudDetail(): Promise<void> {
  const account = accounts.value.find((item) => accountKey(item) === selectedCloudKey.value)
  const version = ++cloudVersion
  cloudData.value = null
  cloudError.value = ''
  cloudLoading.value = false
  if (!account || !loggedIn.value) return
  cloudLoading.value = true
  try {
    const result = await getEfPlayerData(account.roleId, account.serverId)
    if (!disposed && version === cloudVersion) cloudData.value = result
  } catch (error) {
    if (!disposed && version === cloudVersion)
      cloudError.value = errorMessage(error, '云端数据读取失败，请重试。')
  } finally {
    if (!disposed && version === cloudVersion) cloudLoading.value = false
  }
}

async function importData(role: EndfieldRole): Promise<void> {
  const value = credential.value
  if (!loggedIn.value || !value || busy.value) return
  const version = credentialVersion
  importing.value = true
  importingRoleKey.value = accountKey(role)
  importError.value = ''
  notice.value = ''
  try {
    const detail = await getEndfieldCardDetail(value, role)
    if (disposed || version !== credentialVersion) return
    await saveEfPlayerData({ roleId: role.roleId, serverId: role.serverId, playerData: detail })
    if (disposed) return
    notice.value = `已将 ${role.nickname} 的终末地数据导入酸橙云。`
    await loadAccounts(accountKey(role))
  } catch (error) {
    if (!disposed) importError.value = errorMessage(error, '导入失败，请重试。')
  } finally {
    if (!disposed) {
      importing.value = false
      importingRoleKey.value = ''
    }
  }
}

watch(method, () => {
  stopQr()
  qrImage.value = ''
  qrStatus.value = ''
  credentialInput.value = ''
  officialInput.value = ''
  importError.value = ''
})
watch(selectedCloudKey, () => void loadCloudDetail(), { flush: 'sync' })
onBeforeUnmount(() => {
  disposed = true
  resetCredential()
})
void loadAccounts()
</script>

<template>
  <div class="endfield-page">
    <SecondaryPageHeader
      title-id="endfield-game-data-title"
      kicker="ENDFIELD / GAME DATA"
      title-a="游戏数据·终末地"
      description="把森空岛上的《明日方舟：终末地》角色数据导入酸橙云，集中查看与更新。"
      visual-top="TALOS-II"
      visual-bottom="你的探索，随时同步"
      visual-icon="mdi-cube-outline"
      visual-index="02"
    />

    <section class="page-section" aria-labelledby="endfield-import-title">
      <div class="section-heading">
        <div>
          <p class="section-label">01 / IMPORT</p>
          <h2 id="endfield-import-title">导入你的终末地数据。</h2>
          <p>获取凭证后点击要导入的账号，数据将直接上传到你的酸橙云账号。</p>
        </div>
        <v-btn v-if="credential" variant="text" :disabled="busy" @click="resetCredential"
          >清除凭证</v-btn
        >
      </div>

      <div class="import-methods">
        <button
          v-for="(item, index) in methods"
          :key="item.key"
          type="button"
          class="method-card"
          :class="{ selected: method === item.key }"
          :aria-pressed="method === item.key"
          :disabled="busy"
          @click="method = item.key"
        >
          <span class="method-number"
            >0{{ index + 1 }} <v-icon v-if="method === item.key" icon="mdi-check-circle" size="18"
          /></span>
          <v-icon :icon="item.icon" size="28" />
          <strong>{{ item.title }}</strong>
          <span class="method-description">{{ item.description }}</span>
        </button>
      </div>

      <div class="panel credential-panel">
        <form v-if="method === 'credential'" @submit.prevent="submitCredential">
          <h3>输入森空岛凭证</h3>
          <p class="hint">支持单独输入 cred，或 cred,token。凭证仅用于本次读取。</p>
          <v-textarea
            v-model="credentialInput"
            label="森空岛凭证"
            placeholder="cred 或 cred,token"
            rows="2"
            variant="outlined"
            autocomplete="off"
            :disabled="busy"
            hide-details
          />
          <v-btn
            type="submit"
            color="primary"
            :loading="rolesLoading"
            :disabled="busy || !credentialInput.trim()"
            >读取终末地角色</v-btn
          >
        </form>
        <form v-else-if="method === 'official'" @submit.prevent="submitOfficialToken">
          <h3>输入官网 Token</h3>
          <p class="hint">支持鹰角通行证 Token，或 account/info/hg 返回的完整 JSON。</p>
          <v-textarea
            v-model="officialInput"
            label="官网 Token / JSON"
            rows="3"
            variant="outlined"
            autocomplete="off"
            :disabled="busy"
            hide-details
          />
          <v-btn
            type="submit"
            color="primary"
            :loading="rolesLoading"
            :disabled="busy || !officialInput.trim()"
            >读取终末地角色</v-btn
          >
        </form>
        <div v-else class="qr-panel">
          <div>
            <h3>森空岛扫码登录</h3>
            <p class="hint">在森空岛 APP 中扫码，并确认登录授权。</p>
            <p v-if="qrStatus" class="hint" role="status">{{ qrStatus }}</p>
            <v-btn
              color="primary"
              :loading="qrLoading || rolesLoading"
              :disabled="busy || qrLoading"
              @click="startQr"
              >{{ qrImage ? '重新生成二维码' : '生成二维码' }}</v-btn
            >
          </div>
          <img v-if="qrImage" :src="qrImage" alt="森空岛登录二维码" width="200" height="200" />
        </div>
        <p class="privacy-hint">
          <v-icon icon="mdi-shield-check-outline" size="16" />
          森空岛凭证不会保存在本地，离开页面后自动清除。
        </p>
      </div>

      <div v-if="roles.length" class="panel role-panel">
        <h3>选择要导入的账号</h3>
        <p class="hint">共找到 {{ roles.length }} 个账号，确认服务器和 UID 后，点击即可导入。</p>
        <div class="role-list" :aria-busy="importing">
          <button
            v-for="role in roles"
            :key="accountKey(role)"
            type="button"
            class="role-option"
            :disabled="busy || !loggedIn"
            @click="importData(role)"
          >
            <span class="role-copy">
              <strong>{{ role.nickname || role.roleId }} · Lv.{{ role.level ?? '—' }}</strong>
              <small>{{ role.serverName || role.serverId }} · UID {{ role.roleId }}</small>
            </span>
            <span class="role-action">
              <template v-if="importingRoleKey === accountKey(role)">
                <v-progress-circular indeterminate size="18" width="2" />
                正在导入…
              </template>
              <template v-else>
                导入
                <v-icon icon="mdi-arrow-right" size="18" />
              </template>
            </span>
          </button>
        </div>
        <p class="hint">首次导入自动绑定角色，再次导入将更新该角色的整份数据。</p>
      </div>
      <v-alert v-if="importError" type="error" variant="tonal" class="feedback" role="alert">{{
        importError
      }}</v-alert>
      <v-alert v-if="notice" type="success" variant="tonal" class="feedback" role="status">{{
        notice
      }}</v-alert>
      <div v-if="!loggedIn" class="login-hint">
        <span>登录酸橙云后，即可导入并查看云端存档。</span>
        <RouterLink :to="{ name: 'LOGIN', query: { returnTo: '/endfield-game-data' } }"
          >前往登录 <v-icon icon="mdi-arrow-top-right" size="16"
        /></RouterLink>
      </div>
    </section>

    <section class="page-section" aria-labelledby="endfield-cloud-title">
      <div class="section-heading">
        <div>
          <p class="section-label">02 / CLOUD ARCHIVE</p>
          <h2 id="endfield-cloud-title">已导入的终末地角色。</h2>
          <p>选择云端角色，查看最近一次导入的数据。</p>
        </div>
        <v-btn
          v-if="loggedIn"
          variant="text"
          :loading="accountsLoading"
          :disabled="accountsLoading || importing"
          @click="loadAccounts()"
          >刷新存档</v-btn
        >
      </div>
      <div v-if="!loggedIn" class="panel empty-state">
        <v-icon icon="mdi-cloud-lock-outline" size="32" />
        <h3>登录后查看云端存档</h3>
        <p>你的角色数据会跟随酸橙云账号保存。</p>
      </div>
      <template v-else>
        <div v-if="accountsLoading" class="panel status" role="status">
          <v-progress-circular indeterminate size="22" color="primary" /> 正在读取云端账号…
        </div>
        <v-alert v-if="cloudError" type="error" variant="tonal" class="feedback" role="alert">{{
          cloudError
        }}</v-alert>
        <div v-if="!accountsLoading && !accounts.length && !cloudError" class="panel empty-state">
          <v-icon icon="mdi-cloud-upload-outline" size="32" />
          <h3>还没有导入终末地数据。</h3>
          <p>使用上方任意一种方式获取角色数据，完成首次导入。</p>
        </div>
        <div v-if="accounts.length" class="account-grid">
          <button
            v-for="account in accounts"
            :key="accountKey(account)"
            type="button"
            class="account-card"
            :class="{ selected: accountKey(account) === selectedCloudKey }"
            :aria-pressed="accountKey(account) === selectedCloudKey"
            :disabled="importing || accountsLoading"
            @click="selectedCloudKey = accountKey(account)"
          >
            <v-icon icon="mdi-account-box-outline" size="26" />
            <strong>UID {{ account.roleId }}</strong>
            <span>服务器 {{ account.serverId || '默认' }}</span>
            <small>最近导入：{{ formatTime(account.updateTime) }}</small>
          </button>
        </div>
        <div v-if="cloudLoading" class="panel status" role="status">
          <v-progress-circular indeterminate size="22" color="primary" /> 正在读取云端数据…
        </div>
        <div v-else-if="cloudData" class="panel cloud-detail">
          <div class="archive-meta">
            <span>云端存档 · UID {{ cloudData.roleId }}</span
            ><span>更新于 {{ formatTime(cloudData.updateTime) }}</span>
          </div>
          <EndfieldCardDetail :detail="cloudData.playerData" />
        </div>
        <p v-else-if="selectedCloudKey && !cloudError && !accountsLoading" class="hint">
          该角色暂无存档数据，请重新导入。
        </p>
      </template>
    </section>
  </div>
</template>

<style scoped>
.endfield-page {
  width: min(1120px, calc(100% - 64px));
  margin: 0 auto;
  padding: 30px 0 76px;
}
.page-section {
  margin-top: 38px;
}
.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}
.section-label {
  margin: 0;
  color: var(--site-accent);
  font-size: 12px;
  font-weight: 750;
  letter-spacing: 0.08em;
}
.section-heading h2 {
  margin: 8px 0;
  font-size: 26px;
}
.section-heading > div > p:last-child {
  margin: 0;
  color: var(--site-muted);
  font-size: 14px;
  line-height: 1.8;
}
.import-methods {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
}
.method-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 16px;
  min-width: 0;
  padding: 24px;
  border: 1px solid var(--site-line);
  background: var(--site-surface);
  color: var(--site-ink);
  cursor: pointer;
  text-align: left;
}
.method-number {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  color: var(--site-accent);
  font-size: 12px;
  font-weight: 700;
}
.method-card strong {
  font-size: 19px;
}
.method-description {
  color: var(--site-muted);
  font-size: 13px;
  line-height: 1.8;
}
.selected {
  border-color: var(--site-accent) !important;
  box-shadow: inset 0 3px 0 var(--site-accent);
  background: #f0fafb !important;
}
.panel {
  margin-top: 18px;
  padding: 26px;
  border: 1px solid var(--site-line);
  background: var(--site-surface);
}
.panel h3 {
  margin: 0;
  font-size: 18px;
}
.hint {
  margin: 12px 0 18px;
  color: var(--site-muted);
  font-size: 13px;
  line-height: 1.8;
}
.credential-panel form > .v-btn {
  margin-top: 18px;
}
.privacy-hint {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 20px 0 0;
  color: var(--site-muted);
  font-size: 12px;
  line-height: 1.8;
}
.qr-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}
.qr-panel img {
  flex-shrink: 0;
  max-width: 100%;
  object-fit: contain;
}
.status {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-top: 24px;
  padding-bottom: 24px;
  color: var(--site-muted);
  font-size: 14px;
}
.role-list {
  display: grid;
  gap: 12px;
}
.role-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  width: 100%;
  padding: 18px;
  border: 1px solid var(--site-line);
  background: var(--site-surface);
  color: var(--site-ink);
  cursor: pointer;
  text-align: left;
}
.role-option:hover:not(:disabled) {
  border-color: var(--site-accent);
  background: var(--site-paper);
}
.role-copy {
  display: grid;
  gap: 6px;
  min-width: 0;
  overflow-wrap: anywhere;
}
.role-copy small {
  color: var(--site-muted);
  font-size: 12px;
}
.role-action {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 12px;
  color: var(--site-accent);
  font-size: 13px;
}
.feedback {
  margin-top: 18px;
}
.login-hint {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 18px;
  padding: 18px 24px;
  border: 1px solid var(--site-line);
  background: var(--site-accent-soft);
  font-size: 14px;
}
.login-hint a {
  flex-shrink: 0;
  font-weight: 700;
  color: var(--site-accent);
}
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 46px 24px;
  text-align: center;
}
.empty-state p {
  margin: 0;
  color: var(--site-muted);
  font-size: 14px;
}
.account-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  margin-top: 18px;
}
.account-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  min-width: 0;
  padding: 22px;
  border: 1px solid var(--site-line);
  background: var(--site-surface);
  color: var(--site-ink);
  text-align: left;
  cursor: pointer;
  overflow-wrap: anywhere;
}
.account-card span,
.account-card small {
  color: var(--site-muted);
  font-size: 12px;
}
.archive-meta {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--site-line);
  color: var(--site-muted);
  font-size: 12px;
}
button:focus-visible,
a:focus-visible {
  outline: 3px solid var(--site-warm);
  outline-offset: 3px;
}
button:disabled {
  cursor: default;
  opacity: 0.65;
}
@media (max-width: 700px) {
  .endfield-page {
    width: calc(100% - 32px);
    padding-top: 20px;
  }
  .import-methods,
  .account-grid {
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
  }
  .method-card {
    gap: 12px;
    padding: 20px;
  }
  .section-heading {
    align-items: flex-start;
  }
  .section-heading h2 {
    font-size: 22px;
  }
  .panel {
    padding: 20px;
  }
  .qr-panel,
  .login-hint {
    flex-direction: column;
    align-items: flex-start;
  }
  .qr-panel img {
    align-self: center;
  }
}

@media (max-width: 520px) {
  :deep(.secondary-page-header h1) {
    font-size: clamp(28px, 8.5vw, 36px);
  }
}
</style>
