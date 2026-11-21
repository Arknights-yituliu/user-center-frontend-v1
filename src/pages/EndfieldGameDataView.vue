<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import SecondaryPageHeader from '../components/SecondaryPageHeader.vue'
import EndfieldCardDetail from '../components/EndfieldCardDetail.vue'
import {
  getEfPlayerData,
  listEfAccounts,
  type EfAccount,
  type EfPlayerData,
} from '../api/user-center/ef-account-api'
import { getTclToken } from '../api/user-center/request'
import endfieldIcon from '../assets/ef.webp'

const accounts = ref<EfAccount[]>([])
const accountsLoading = ref(false)
const selectedCloudKey = ref('')
const cloudData = ref<EfPlayerData | null>(null)
const cloudLoading = ref(false)
const cloudError = ref('')
const loggedIn = ref(Boolean(getTclToken()))
let disposed = false
let cloudVersion = 0

function accountKey(account: { roleId: string; serverId: string }): string {
  return JSON.stringify([account.serverId, account.roleId])
}

function errorMessage(error: unknown, fallback: string): string {
  const payload = error as { code?: number; msg?: string; message?: string }
  if (payload?.code === 80001 || payload?.code === 80002) {
    loggedIn.value = false
    accounts.value = []
    selectedCloudKey.value = ''
    cloudData.value = null
    cloudVersion += 1
    return '酸橙云登录已失效，请重新登录后查看。'
  }
  return payload?.msg || payload?.message || fallback
}

function formatTime(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false })
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

watch(selectedCloudKey, () => void loadCloudDetail(), { flush: 'sync' })
onBeforeUnmount(() => {
  disposed = true
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
      :visual-image="endfieldIcon"
      visual-index="02"
    />

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
          :disabled="accountsLoading"
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
          <p>该账号下还没有云端记录，去「森空岛数据同步」导入一次后即可在此查看。</p>
        </div>
        <div v-if="accounts.length" class="account-grid">
          <button
            v-for="account in accounts"
            :key="accountKey(account)"
            type="button"
            class="account-card"
            :class="{ selected: accountKey(account) === selectedCloudKey }"
            :aria-pressed="accountKey(account) === selectedCloudKey"
            :disabled="accountsLoading"
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
.status {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-top: 24px;
  padding-bottom: 24px;
  color: var(--site-muted);
  font-size: 14px;
}
.feedback {
  margin-top: 18px;
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
  .account-grid {
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
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
}

@media (max-width: 520px) {
  :deep(.secondary-page-header h1) {
    font-size: clamp(28px, 8.5vw, 36px);
  }
}
</style>
